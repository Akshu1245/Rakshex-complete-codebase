/**
 * Scan workspace / changed files using local deterministic scanner heuristics
 * aligned with scanner-core patterns (no secrets logged).
 */
import * as vscode from "vscode";
import * as path from "path";
import type { RakshexApi } from "./api";

export type LocalFinding = {
  file: string;
  line: number;
  message: string;
  severity: vscode.DiagnosticSeverity;
  ruleId: string;
};

const diagnosticCollection = vscode.languages.createDiagnosticCollection("rakshex");

const RULES: Array<{
  id: string;
  re: RegExp;
  message: string;
  severity: vscode.DiagnosticSeverity;
}> = [
  {
    id: "local.insecure_http",
    re: /https?:\/\/(?!localhost|127\.0\.0\.1)[^\s"'`]+/i,
    message: "HTTP(S) endpoint URL detected — prefer HTTPS and avoid hardcoding secrets nearby",
    severity: vscode.DiagnosticSeverity.Warning,
  },
  {
    id: "local.secret_pattern",
    re: /\b(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,})\b/,
    message: "Possible secret material — rotate and move to SecretStorage / vault",
    severity: vscode.DiagnosticSeverity.Error,
  },
  {
    id: "local.missing_auth_hint",
    re: /["']Authorization["']\s*:\s*["']\s*["']/,
    message: "Empty Authorization header value",
    severity: vscode.DiagnosticSeverity.Warning,
  },
];

function scanText(file: string, text: string): LocalFinding[] {
  const findings: LocalFinding[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        // Never include the secret value in the message
        findings.push({
          file,
          line: i,
          message: `${rule.id}: ${rule.message}`,
          severity: rule.severity,
          ruleId: rule.id,
        });
      }
    }
  }
  return findings;
}

function applyDiagnostics(findings: LocalFinding[]): void {
  const byFile = new Map<string, vscode.Diagnostic[]>();
  for (const f of findings) {
    const uri = vscode.Uri.file(f.file);
    const key = uri.toString();
    const list = byFile.get(key) ?? [];
    const range = new vscode.Range(f.line, 0, f.line, 200);
    const d = new vscode.Diagnostic(range, f.message, f.severity);
    d.source = "Rakshex";
    d.code = f.ruleId;
    list.push(d);
    byFile.set(key, list);
  }
  diagnosticCollection.clear();
  for (const [uriStr, diags] of byFile) {
    diagnosticCollection.set(vscode.Uri.parse(uriStr), diags);
  }
}

async function listCandidateFiles(
  folder: vscode.WorkspaceFolder,
  changedOnly: boolean,
  token: vscode.CancellationToken,
): Promise<string[]> {
  if (changedOnly) {
    // Git changed files if available
    try {
      const gitExt = vscode.extensions.getExtension("vscode.git");
      await gitExt?.activate();
      const api = (gitExt?.exports as { getAPI?: (v: number) => any })?.getAPI?.(1);
      const repo = api?.repositories?.[0];
      if (repo) {
        const changes = [
          ...(repo.state?.workingTreeChanges ?? []),
          ...(repo.state?.indexChanges ?? []),
        ];
        return changes
          .map((c: { uri?: vscode.Uri }) => c.uri?.fsPath)
          .filter((p: string | undefined): p is string => Boolean(p));
      }
    } catch {
      /* fall through */
    }
  }

  const pattern = new vscode.RelativePattern(folder, "**/*.{json,yml,yaml,ts,js,py,env}");
  const uris = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 200);
  if (token.isCancellationRequested) return [];
  return uris.map((u) => u.fsPath);
}

export class ScanWorkspaceCommand {
  constructor(private readonly _api: RakshexApi) {}

  async execute(changedOnly = false): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      void vscode.window.showInformationMessage("Rakshex: open a workspace folder first.");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: changedOnly ? "Rakshex: scanning changed files…" : "Rakshex: scanning workspace…",
        cancellable: true,
      },
      async (progress, token) => {
        const files = await listCandidateFiles(folder, changedOnly, token);
        progress.report({ message: `${files.length} files` });
        const all: LocalFinding[] = [];
        let i = 0;
        for (const file of files) {
          if (token.isCancellationRequested) break;
          i++;
          if (i % 10 === 0) progress.report({ message: `${i}/${files.length}` });
          try {
            const doc = await vscode.workspace.openTextDocument(file);
            all.push(...scanText(file, doc.getText()));
          } catch {
            /* skip unreadable */
          }
        }
        applyDiagnostics(all);
        const secrets = all.filter((f) => f.ruleId === "local.secret_pattern").length;
        void vscode.window.showInformationMessage(
          `Rakshex: ${all.length} issue(s) in workspace${secrets ? ` (${secrets} possible secrets)` : ""}. See Problems panel.`,
        );
      },
    );
  }
}

export function getRakshexDiagnostics(): vscode.DiagnosticCollection {
  return diagnosticCollection;
}
