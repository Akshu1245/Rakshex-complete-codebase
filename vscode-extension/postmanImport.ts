import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { DevPulseApi } from "./api";

interface PostmanCredential {
  type: string;
  location: string;
  keyPreview: string;
  severity: "Critical" | "High";
}

interface PostmanFinding {
  id: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  title: string;
  endpoint: string;
  category: string;
  remediation: string;
}

interface PostmanScanResult {
  collectionName: string;
  endpoints: string[];
  findings: PostmanFinding[];
  credentials: PostmanCredential[];
  riskScore: number;
  owaspScore: number;
  pciScore: number;
  scanTime: number;
}

export class PostmanImportCommand {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly api: DevPulseApi
  ) {}

  async execute(): Promise<void> {
    // Step 1: Pick file
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        "Postman Collections": ["json"],
        "All Files": ["*"],
      },
      openLabel: "Import & Scan",
    });

    if (!uris || uris.length === 0) {
      return;
    }

    const filePath = uris[0].fsPath;
    const fileName = path.basename(filePath);

    // Step 2: Read and validate
    let collection: any;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      collection = JSON.parse(content);
    } catch (err) {
      vscode.window.showErrorMessage(
        `DevPulse: Could not read Postman collection — ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    // Step 3: Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `🔍 DevPulse: Scanning ${fileName}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 30, message: "Parsing collection..." });

        // Step 4: Run scan (client-side for speed, or API if authenticated)
        const result = await this.performScan(collection, fileName);

        progress.report({ increment: 70, message: "Findings ready!" });

        // Step 5: Show results — THE OH CRAP MOMENT
        await this.showResults(result, filePath);
      }
    );
  }

  private async performScan(
    collection: any,
    fileName: string
  ): Promise<PostmanScanResult> {
    const findings: PostmanFinding[] = [];
    const credentials: PostmanCredential[] = [];
    const endpoints: string[] = [];

    const walkItems = (items: any[], path: string = "") => {
      items?.forEach((item, idx) => {
        const currentPath = path
          ? `${path} > ${item.name || `Item ${idx}`}`
          : item.name || `Item ${idx}`;

        if (item.request) {
          const req = item.request;
          const url =
            typeof req.url === "string"
              ? req.url
              : req.url?.raw ||
                (req.url?.host?.join(".") || "unknown");
          const method = req.method || "GET";
          const endpointId = `${method} ${url}`;
          endpoints.push(endpointId);

          // Insecure HTTP
          if (url.startsWith("http://")) {
            findings.push({
              id: `find-${findings.length}`,
              severity: "High",
              title: "Insecure HTTP endpoint — data transmitted in plaintext",
              endpoint: endpointId,
              category: "OWASP API2:2023",
              remediation: "Change to HTTPS. Use tls:// or https:// protocol.",
            });
          }

          // Missing auth
          const headers = req.header || [];
          const headerNames = headers.map((h: any) =>
            (h.key || "").toLowerCase()
          );
          if (
            !headerNames.includes("authorization") &&
            !headerNames.includes("x-api-key") &&
            !headerNames.includes("x-auth-token")
          ) {
            findings.push({
              id: `find-${findings.length}`,
              severity: "Medium",
              title: "No authentication header detected",
              endpoint: endpointId,
              category: "OWASP API2:2023",
              remediation:
                "Add Authorization: Bearer <token> or X-API-Key header.",
            });
          }

          // Secret detection
          const allText = JSON.stringify({
            url,
            headers,
            body: req.body,
          });
          const patterns = [
            { regex: /sk-[a-zA-Z0-9]{48}/g, type: "OpenAI API Key" },
            { regex: /sk-ant-[a-zA-Z0-9]{32,}/g, type: "Anthropic API Key" },
            { regex: /AIza[0-9A-Za-z_-]{35}/g, type: "Google AI API Key" },
            {
              regex: /Bearer\s+[a-zA-Z0-9._-]{20,}/g,
              type: "Bearer Token",
            },
            {
              regex: /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi,
              type: "Hardcoded API Key",
            },
            {
              regex: /password\s*[:=]\s*["'][^"']{4,}["']/gi,
              type: "Hardcoded Password",
            },
          ];

          patterns.forEach(({ regex, type }) => {
            const matches = allText.match(regex);
            if (matches) {
              matches.forEach((match) => {
                const preview =
                  match.substring(0, 8) +
                  "..." +
                  match.substring(match.length - 4);
                credentials.push({
                  type,
                  location: currentPath,
                  keyPreview: preview,
                  severity: "Critical",
                });
                findings.push({
                  id: `find-${findings.length}`,
                  severity: "Critical",
                  title: `EXPOSED: ${type} found in collection`,
                  endpoint: endpointId,
                  category: "Secret Leak",
                  remediation: `Move ${type} to environment variables or a secret manager (AWS Secrets Manager, Azure Key Vault, 1Password).`,
                });
              });
            }
          });

          // BOLA pattern
          if (
            /\{\{userId\}\}|\{userId\}|\/:userId/.test(url) &&
            !headerNames.includes("authorization")
          ) {
            findings.push({
              id: `find-${findings.length}`,
              severity: "Critical",
              title: "BOLA vulnerability — user ID in URL without authorization",
              endpoint: endpointId,
              category: "OWASP API1:2023",
              remediation:
                "Add authorization check: verify the authenticated user owns this resource ID.",
            });
          }
        }

        if (item.item) {
          walkItems(item.item, currentPath);
        }
      });
    };

    walkItems(collection.item || []);

    // Deduplicate
    const uniqueFindings = findings.filter(
      (f, i, arr) =>
        arr.findIndex(
          (t) => t.title === f.title && t.endpoint === f.endpoint
        ) === i
    );
    const uniqueCredentials = credentials.filter(
      (c, i, arr) =>
        arr.findIndex((t) => t.keyPreview === c.keyPreview) === i
    );

    // Risk score
    const weights = { Critical: 10, High: 7, Medium: 4, Low: 1 };
    const rawRisk = uniqueFindings.reduce(
      (sum, f) => sum + (weights[f.severity] || 0),
      0
    );
    const maxRisk = uniqueFindings.length * 10 || 1;
    const riskScore = Math.min(100, Math.round((rawRisk / maxRisk) * 100));

    const criticalCount = uniqueFindings.filter(
      (f) => f.severity === "Critical"
    ).length;
    const highCount = uniqueFindings.filter(
      (f) => f.severity === "High"
    ).length;
    const owaspScore = Math.max(
      0,
      Math.round(100 - (criticalCount * 15 + highCount * 8))
    );
    const pciScore = Math.max(
      0,
      Math.round(100 - (criticalCount * 20 + highCount * 10))
    );

    return {
      collectionName: collection.info?.name || fileName,
      endpoints: [...new Set(endpoints)],
      findings: uniqueFindings,
      credentials: uniqueCredentials,
      riskScore,
      owaspScore,
      pciScore,
      scanTime: 0,
    };
  }

  private async showResults(
    result: PostmanScanResult,
    filePath: string
  ): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "devpulsePostmanResults",
      `🔍 ${result.collectionName}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const hasCredentials = result.credentials.length > 0;
    const hasCritical = result.findings.some((f) => f.severity === "Critical");

    // If credentials found, show the OH CRAP notification immediately
    if (hasCredentials) {
      vscode.window
        .showWarningMessage(
          `🚨 DevPulse found ${result.credentials.length} exposed credential${
            result.credentials.length > 1 ? "s" : ""
          } in your Postman collection. This has been visible to anyone with access.`,
          "View Details",
          "Dismiss"
        )
        .then((selection) => {
          if (selection === "View Details") {
            panel.reveal();
          }
        });
    }

    // Also show summary notification
    if (result.findings.length > 0) {
      vscode.window.showInformationMessage(
        `DevPulse: ${result.findings.length} finding${
          result.findings.length > 1 ? "s" : ""
        } in ${result.endpoints.length} endpoint${
          result.endpoints.length > 1 ? "s" : ""
        }. Risk score: ${result.riskScore}/100.`,
        "Open Report",
        "Copy Summary"
      );
    } else {
      vscode.window.showInformationMessage(
        `✅ DevPulse: All clear! No vulnerabilities found in ${result.collectionName}.`,
        "Great!"
      );
    }

    panel.webview.html = this.getResultsHtml(result, filePath);
  }

  private getResultsHtml(
    result: PostmanScanResult,
    filePath: string
  ): string {
    const credentialSection = result.credentials.length
      ? `
      <div style="background: rgba(239,68,68,0.1); border: 2px solid rgba(239,68,68,0.5); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 28px;">🚨</span>
          <div>
            <h2 style="color: #ef4444; margin: 0; font-size: 20px;">Exposed Credentials Found</h2>
            <p style="color: #fca5a5; margin: 4px 0 0 0; font-size: 14px;">
              ${result.credentials.length} secret${result.credentials.length > 1 ? "s" : ""} visible in this collection. Anyone with access can see them.
            </p>
          </div>
        </div>
        ${result.credentials
          .map(
            (c) => `
          <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; color: white;">${c.type}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Location: ${c.location}</div>
              <div style="font-family: monospace; color: #fca5a5; font-size: 13px; margin-top: 4px;">${c.keyPreview}</div>
            </div>
            <span style="background: rgba(239,68,68,0.2); color: #ef4444; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">CRITICAL</span>
          </div>
        `
          )
          .join("")}
        <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px; margin-top: 12px;">
          <p style="color: #fca5a5; margin: 0; font-size: 13px;">
            <strong>Immediate action:</strong> Rotate these credentials NOW. Remove them from the collection and store in environment variables or a secret manager.
          </p>
        </div>
      </div>
    `
      : "";

    const findingsList = result.findings.length
      ? result.findings
          .map((f) => {
            const color =
              f.severity === "Critical"
                ? "#ef4444"
                : f.severity === "High"
                ? "#f97316"
                : f.severity === "Medium"
                ? "#eab308"
                : "#22c55e";
            const bg =
              f.severity === "Critical"
                ? "rgba(239,68,68,0.1)"
                : f.severity === "High"
                ? "rgba(249,115,22,0.1)"
                : f.severity === "Medium"
                ? "rgba(234,179,8,0.1)"
                : "rgba(34,197,94,0.1)";
            return `
            <div style="background: ${bg}; border-left: 4px solid ${color}; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="color: ${color}; font-weight: 700; font-size: 13px;">${f.severity}</span>
                <span style="color: #64748b;">·</span>
                <span style="color: #94a3b8; font-size: 13px;">${f.category}</span>
              </div>
              <div style="font-weight: 600; color: white; margin-bottom: 4px;">${f.title}</div>
              <div style="font-family: monospace; color: #64748b; font-size: 12px; margin-bottom: 8px;">${f.endpoint}</div>
              <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 10px;">
                <span style="color: #4ade80; font-weight: 600;">Fix:</span>
                <span style="color: #cbd5e1; font-size: 13px;">${f.remediation}</span>
              </div>
            </div>
          `;
          })
          .join("")
      : `<div style="text-align: center; padding: 40px; color: #22c55e;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h3 style="color: #22c55e; margin: 0;">No vulnerabilities found!</h3>
          <p style="color: #94a3b8;">This collection looks clean.</p>
        </div>`;

    const riskColor =
      result.riskScore >= 70 ? "#ef4444" : result.riskScore >= 40 ? "#f97316" : "#22c55e";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 24px;
      line-height: 1.6;
    }
    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #334155;
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .score-card {
      background: rgba(30,41,59,0.8);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .score-value {
      font-size: 32px;
      font-weight: 700;
      margin: 8px 0;
    }
    .score-label {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cta-section {
      background: linear-gradient(135deg, rgba(147,51,234,0.2), rgba(236,72,153,0.2));
      border: 1px solid rgba(147,51,234,0.4);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-top: 24px;
    }
    .btn-primary {
      background: #9333ea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      margin: 8px;
    }
    .btn-primary:hover { background: #a855f7; }
    .btn-secondary {
      background: #334155;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      margin: 8px;
    }
    .btn-secondary:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0 0 4px 0;">🔍 ${result.collectionName}</h1>
    <p style="color: #64748b; margin: 0; font-size: 13px;">${result.endpoints.length} endpoints scanned · ${result.findings.length} findings · ${result.scanTime}ms</p>
  </div>

  <div class="score-grid">
    <div class="score-card">
      <div class="score-label">Risk Score</div>
      <div class="score-value" style="color: ${riskColor};">${result.riskScore}</div>
      <div style="font-size: 11px; color: #64748b;">/100</div>
    </div>
    <div class="score-card">
      <div class="score-label">Endpoints</div>
      <div class="score-value" style="color: white;">${result.endpoints.length}</div>
    </div>
    <div class="score-card">
      <div class="score-label">OWASP</div>
      <div class="score-value" style="color: ${result.owaspScore >= 80 ? '#22c55e' : result.owaspScore >= 50 ? '#eab308' : '#ef4444'};">${result.owaspScore}</div>
      <div style="font-size: 11px; color: #64748b;">/100</div>
    </div>
    <div class="score-card">
      <div class="score-label">PCI DSS</div>
      <div class="score-value" style="color: ${result.pciScore >= 80 ? '#22c55e' : result.pciScore >= 50 ? '#eab308' : '#ef4444'};">${result.pciScore}</div>
      <div style="font-size: 11px; color: #64748b;">/100</div>
    </div>
  </div>

  ${credentialSection}

  <h2 style="color: white; margin-bottom: 16px;">Security Findings</h2>
  ${findingsList}

  <div class="cta-section">
    <h3 style="margin: 0 0 8px 0;">Want continuous protection?</h3>
    <p style="color: #cbd5e1; margin: 0 0 16px 0; font-size: 14px;">
      Get DevPulse in VS Code for real-time scans, CI/CD integration, and cost monitoring.
    </p>
    <button class="btn-primary" onclick="vscode.postMessage({type:'signup'})">
      Get DevPulse Free →
    </button>
    <button class="btn-secondary" onclick="vscode.postMessage({type:'copyReport'})">
      📋 Copy Report
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>
    `;
  }
}
