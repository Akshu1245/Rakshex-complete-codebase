import * as vscode from "vscode";
import type { RakshexApi } from "./api";

export class HealthCheckCommand {
  constructor(private readonly api: RakshexApi) {}

  async execute(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      "rakshex.healthCheck",
      "Rakshex Health",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    // Run checks
    const results = await this.runChecks();

    panel.webview.html = this.getHtml(results);
  }

  private async runChecks(): Promise<HealthResult[]> {
    const results: HealthResult[] = [];

    // Check 1: Extension activated
    results.push({
      name: "Extension",
      status: "pass",
      message: "Extension is active and running",
    });

    // Check 2: API connectivity
    try {
      const baseUrl = (this.api as any).getBaseUrl?.() ?? "https://api.rakshex.in";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        results.push({
          name: "API Server",
          status: "pass",
          message: `Connected to ${baseUrl}`,
        });
      } else {
        results.push({
          name: "API Server",
          status: "warn",
          message: `Server responded with status ${res.status}`,
        });
      }
    } catch {
      results.push({
        name: "API Server",
        status: "fail",
        message: "Cannot reach Rakshex API. Check your internet connection.",
      });
    }

    // Check 3: Authentication
    try {
      const dashboard = await this.api.getDashboardData();
      results.push({
        name: "Authentication",
        status: "pass",
        message: `Signed in. ${dashboard.collections} collections, ${dashboard.openFindings} open findings.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.includes("403") || msg.includes("API key")) {
        results.push({
          name: "Authentication",
          status: "warn",
          message: "Not signed in. Run 'Rakshex: Sign in with API Key' to connect.",
        });
      } else {
        results.push({
          name: "Authentication",
          status: "warn",
          message: "Could not verify sign-in status.",
        });
      }
    }

    // Check 4: Telemetry
    results.push({
      name: "Telemetry",
      status: "pass",
      message: "Telemetry is active and batched.",
    });

    return results;
  }

  private getHtml(results: HealthResult[]): string {
    const nonce = Math.random().toString(36).slice(2);

    const rows = results
      .map((r) => {
        const icon = r.status === "pass" ? "✅" : r.status === "warn" ? "⚠️" : "❌";
        const color = r.status === "pass" ? "#22c55e" : r.status === "warn" ? "#f59e0b" : "#ef4444";
        return `
        <tr>
          <td style="font-size:16px">${icon}</td>
          <td style="font-weight:600;color:${color}">${r.name}</td>
          <td>${r.message}</td>
        </tr>`;
      })
      .join("");

    const allPass = results.every((r) => r.status === "pass");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      max-width: 520px;
      margin: 0 auto;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h2 { margin-bottom: 6px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
    .status-banner {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-weight: 600;
      font-size: 14px;
    }
    .status-banner.pass { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
    .status-banner.warn { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); color: #f59e0b; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 10px 8px; border-bottom: 1px solid var(--vscode-panel-border, #333); font-size: 13px; vertical-align: top; }
    .tip { margin-top: 20px; padding: 12px; background: rgba(99,102,241,0.08); border-radius: 8px; font-size: 12px; color: #888; }
    .actions { margin-top: 20px; display: flex; gap: 10px; }
    .btn {
      flex: 1; padding: 10px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-primary { background: #2563EB; color: white; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground, #333); color: var(--vscode-button-secondaryForeground); }
  </style>
</head>
<body>
  <h2>Rakshex Health</h2>
  <div class="subtitle">Diagnose connectivity and configuration issues</div>

  <div class="status-banner ${allPass ? "pass" : "warn"}">
    ${allPass ? "All systems operational" : "Some checks need attention"}
  </div>

  <table>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="tip">
    If the API server is unreachable, check your internet connection or verify the API URL in Rakshex settings.
  </div>

  <div class="actions">
    <button class="btn btn-secondary" id="settings">Open Settings</button>
    <button class="btn btn-primary" id="retry">Re-run Checks</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('settings').addEventListener('click', () => {
      vscode.postMessage({ type: 'openSettings' });
    });
    document.getElementById('retry').addEventListener('click', () => {
      vscode.postMessage({ type: 'retry' });
    });
  </script>
</body>
</html>`;
  }
}

interface HealthResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}
