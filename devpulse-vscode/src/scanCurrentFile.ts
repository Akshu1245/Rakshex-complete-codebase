import * as vscode from "vscode";
import type { DevPulseApi } from "./api";

/**
 * Scans the currently active editor file for API definitions and
 * security vulnerabilities.
 *
 * Supported file types:
 *   - OpenAPI / Swagger YAML/JSON
 *   - Postman collection JSON
 *   - TypeScript / JavaScript (detects API route definitions)
 *   - Python (detects FastAPI/Flask route definitions)
 */
export class ScanCurrentFileCommand {
  constructor(private readonly api: DevPulseApi) {}

  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage(
        "DevPulse: open a file to scan.",
      );
      return;
    }

    const document = editor.document;
    const filePath = document.fileName;
    const fileName = filePath.split(/[/\\]/).pop() ?? "unknown";
    const content = document.getText();

    if (content.trim().length === 0) {
      void vscode.window.showInformationMessage(
        "DevPulse: file is empty — nothing to scan.",
      );
      return;
    }

    // Detect file type
    const fileType = this.detectFileType(fileName, content);
    if (!fileType) {
      void vscode.window.showInformationMessage(
        "DevPulse: this file doesn't look like an API definition. Supported: OpenAPI/Swagger (yaml/json), Postman collections, TypeScript/Python route files.",
      );
      return;
    }

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `DevPulse: Scanning ${fileName}…`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: "Detecting API endpoints…" });

        try {
          const findings = await this.scanContent(
            fileName,
            content,
            fileType,
          );

          progress.report({
            message: findings.length > 0
              ? `Found ${findings.length} issue${findings.length !== 1 ? "s" : ""}`
              : "No issues found",
          });

          if (findings.length > 0) {
            this.applyDiagnostics(document, findings);

            void vscode.window.showWarningMessage(
              `DevPulse: ${findings.length} security issue${findings.length !== 1 ? "s" : ""} found in ${fileName}. See the Problems panel or DevPulse Findings view.`,
              "View Findings",
            ).then((action) => {
              if (action === "View Findings") {
                vscode.commands.executeCommand("devpulse.findings.focus");
              }
            });
          } else {
            void vscode.window.showInformationMessage(
              `DevPulse: no issues found in ${fileName}. ✅`,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(
            `DevPulse: scan failed — ${msg}`,
          );
        }
      },
    );
  }

  private detectFileType(
    fileName: string,
    content: string,
  ): "openapi" | "postman" | "typescript" | "python" | null {
    const lower = fileName.toLowerCase();

    // Extension-based detection
    if (lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".json")) {
      const trimmed = content.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (
            parsed.openapi ||
            parsed.swagger ||
            parsed.info?._postman_id ||
            parsed.item
          ) {
            return parsed.openapi || parsed.swagger
              ? "openapi"
              : "postman";
          }
        } catch {
          // Not JSON — check YAML
        }
      }
      // OpenAPI YAML detection
      if (
        /\bopenapi\s*:\s*["']?\d+\.\d+/.test(content) ||
        /\bswagger\s*:\s*["']?\d+\.\d+/.test(content)
      ) {
        return "openapi";
      }
    }

    if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".js") || lower.endsWith(".jsx")) {
      // TypeScript/JS: look for API route patterns
      if (
        /\.get\(|\.post\(|\.put\(|\.patch\(|\.delete\(|\.all\(|router\.(get|post|put)|app\.(get|post|put)|createRoute|fetch\(/.test(content)
      ) {
        return "typescript";
      }
    }

    if (lower.endsWith(".py")) {
      if (
        /@app\.(get|post|put|patch|delete)|@router\.(get|post|put)|@blueprint\.route|FastAPI|Flask|def\s+\w+.*request/i.test(content)
      ) {
        return "python";
      }
    }

    return null;
  }

  private async scanContent(
    fileName: string,
    content: string,
    fileType: "openapi" | "postman" | "typescript" | "python",
  ): Promise<Array<{
    title: string;
    severity: string;
    line?: number;
    description: string;
    category?: string;
  }>> {
    const findings: Array<{
      title: string;
      severity: string;
      line?: number;
      description: string;
      category?: string;
    }> = [];

    const lines = content.split("\n");

    // Check for hardcoded secrets (API keys, tokens, passwords)
    const secretPatterns = [
      {
        regex: /(?:api[_-]?key|apikey|secret|token|password|passwd)\s*[:=]\s*["']([^"'\n]{8,})["']/gi,
        title: "Hardcoded secret detected",
        severity: "Critical",
        category: "Secret Exposure",
      },
      {
        regex: /(?:authorization|auth)\s*[:=]\s*["']?(?:Bearer|Basic)\s+([^\s"'\n]{8,})/gi,
        title: "Hardcoded auth token",
        severity: "Critical",
        category: "Secret Exposure",
      },
      {
        regex: /(?:sk-|xai-|AIza)[a-zA-Z0-9_-]{20,}/g,
        title: "Exposed API key (OpenAI/Google/xAI)",
        severity: "Critical",
        category: "Secret Exposure",
      },
      {
        regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
        title: "Exposed AWS access key",
        severity: "Critical",
        category: "Secret Exposure",
      },
    ];

    for (const pattern of secretPatterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(line)) {
          findings.push({
            title: pattern.title,
            severity: pattern.severity,
            line: i,
            description: `Line ${i + 1} contains a potential ${pattern.category.toLowerCase()}. Rotate this secret immediately.`,
            category: pattern.category,
          });
        }
      }
    }

    // Check for missing HTTPS
    for (let i = 0; i < lines.length; i++) {
      if (/http:\/\/[^\s"']+/.test(lines[i]) && !/localhost|127\.0\.0\.1/.test(lines[i])) {
        findings.push({
          title: "HTTP endpoint (not HTTPS)",
          severity: "Medium",
          line: i,
          description: `Line ${i + 1} uses http:// instead of https://. Use HTTPS for all production endpoints.`,
          category: "Insecure Transport",
        });
      }
    }

    // Check for debug/test endpoints in non-test files
    if (!fileName.includes(".test.") && !fileName.includes(".spec.")) {
      for (let i = 0; i < lines.length; i++) {
        if (/\b(debug|test|staging)\b.*\b(endpoint|api|route)\b/i.test(lines[i])) {
          findings.push({
            title: "Debug/test endpoint in production code",
            severity: "High",
            line: i,
            description: `Line ${i + 1} references a debug or test endpoint. Ensure this is not deployable to production.`,
            category: "Insecure Endpoint",
          });
        }
      }
    }

    // TypeScript-specific checks
    if (fileType === "typescript") {
      for (let i = 0; i < lines.length; i++) {
        if (/cors\(\)|cors\s*\(\s*\)/.test(lines[i]) && !/origin.*allowlist|allowedOrigins/.test(content)) {
          findings.push({
            title: "CORS configured without origin allowlist",
            severity: "Medium",
            line: i,
            description: `Line ${i + 1}: cors() called without an origin allowlist. This allows requests from any origin.`,
            category: "CORS Misconfiguration",
          });
        }
        if (/helmet\(\)|helmet\s*\(\s*\)/.test(lines[i])) {
          // Helmet is good — skip
        }
      }
    }

    // OpenAPI-specific checks
    if (fileType === "openapi") {
      for (let i = 0; i < lines.length; i++) {
        if (/security\s*:\s*\[\s*\]/.test(lines[i]) || /security\s*:\s*\[\s*\{\s*\}\s*\]/.test(lines[i])) {
          findings.push({
            title: "Endpoint with no security scheme",
            severity: "High",
            line: i,
            description: `Line ${i + 1}: API endpoint defined without authentication. All endpoints should require auth.`,
            category: "Missing Authentication",
          });
        }
      }
    }

    return findings;
  }

  private applyDiagnostics(
    document: vscode.TextDocument,
    findings: Array<{
      title: string;
      severity: string;
      line?: number;
      description: string;
      category?: string;
    }>,
  ): void {
    const diagnosticCollection =
      vscode.languages.createDiagnosticCollection("devpulse");

    const diagnostics: vscode.Diagnostic[] = [];

    for (const finding of findings) {
      const line = finding.line ?? 0;
      const lineText = document.lineAt(Math.min(line, document.lineCount - 1));
      const range = lineText.range;

      const severity =
        finding.severity === "Critical"
          ? vscode.DiagnosticSeverity.Error
          : finding.severity === "High"
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(
        range,
        `[${finding.severity}] ${finding.title}: ${finding.description}`,
        severity,
      );

      diagnostic.source = "DevPulse";
      diagnostic.code = finding.category ?? "security";
      diagnostics.push(diagnostic);
    }

    diagnosticCollection.set(document.uri, diagnostics);
  }
}
