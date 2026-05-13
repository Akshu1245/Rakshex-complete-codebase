/**
 * VS Code wrapper for the shadow-API workspace scanner.
 *
 * Glue layer between the pure scanner (shadowApiScanner.ts) and the editor:
 *   - reads candidate files via vscode.workspace.findFiles
 *   - reads file contents via vscode.workspace.fs.readFile
 *   - presents detected routes in an output channel and offers a quick-pick
 *     to jump to the source location
 *
 * Patent surface NHCE/DEV/2026/003 (Shadow API Discovery via IDE Correlation).
 *
 * Comparing the detected list against tracked endpoints (Postman/OpenAPI
 * collections) happens server-side — the extension shows the raw detected
 * set so a developer can spot routes the security inventory is missing
 * without round-tripping to the dashboard.
 */
import * as vscode from "vscode";
import {
  detectRoutesInFile,
  type DetectedRoute,
} from "./shadowApiScanner";

const FILE_GLOB = "**/*.{js,jsx,ts,tsx,mjs,cjs,py,java,kt,php}";
const EXCLUDE_GLOB =
  "**/{node_modules,.git,dist,build,out,target,vendor,__pycache__,.venv,venv,.next,.nuxt}/**";

const MAX_FILES = 2_000;
const MAX_FILE_BYTES = 256 * 1024; // 256 KiB — large enough for any real route file

interface DetectedWithUri extends DetectedRoute {
  uri: vscode.Uri;
}

async function readFileSafe(uri: vscode.Uri): Promise<string | null> {
  try {
    const buf = await vscode.workspace.fs.readFile(uri);
    if (buf.byteLength > MAX_FILE_BYTES) return null;
    return Buffer.from(buf).toString("utf8");
  } catch {
    return null;
  }
}

export async function runShadowApiScan(): Promise<DetectedWithUri[]> {
  const files = await vscode.workspace.findFiles(
    FILE_GLOB,
    EXCLUDE_GLOB,
    MAX_FILES
  );
  if (files.length === 0) return [];

  const detected: DetectedWithUri[] = [];
  for (const uri of files) {
    const contents = await readFileSafe(uri);
    if (contents === null) continue;
    const found = detectRoutesInFile(uri.fsPath, contents);
    for (const r of found) detected.push({ ...r, uri });
  }
  return detected;
}

export interface ShadowApiOptions {
  isTrusted: () => boolean;
}

export function registerShadowApiCommand(
  context: vscode.ExtensionContext,
  options?: ShadowApiOptions
): void {
  const channel = vscode.window.createOutputChannel("DevPulse Shadow API");
  context.subscriptions.push(channel);

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.scanShadowApis", async () => {
      if (options && !options.isTrusted()) {
        void vscode.window.showWarningMessage(
          "DevPulse: shadow API scanning requires a trusted workspace. Trust this workspace to enable scanning."
        );
        return;
      }

      const detected = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "DevPulse: scanning workspace for shadow APIs",
        },
        () => runShadowApiScan()
      );

      channel.clear();
      channel.appendLine(
        `# DevPulse Shadow API scan — ${new Date().toISOString()}`
      );
      channel.appendLine(`Detected ${detected.length} HTTP route(s).`);
      for (const r of detected) {
        channel.appendLine(
          `${r.method.padEnd(7)} ${r.path.padEnd(40)} ${r.framework.padEnd(13)} ${vscode.workspace.asRelativePath(r.uri)}:${r.line}`
        );
      }
      channel.show(true);

      if (detected.length === 0) {
        await vscode.window.showInformationMessage(
          "DevPulse: no HTTP routes detected in this workspace."
        );
        return;
      }

      const items = detected.map(r => ({
        label: `${r.method} ${r.path}`,
        description: `${r.framework} · ${vscode.workspace.asRelativePath(r.uri)}:${r.line}`,
        detail: r.snippet.slice(0, 120),
        route: r,
      }));
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: `Found ${detected.length} routes — select one to open the source location`,
      });
      if (!pick) return;

      const doc = await vscode.workspace.openTextDocument(pick.route.uri);
      const editor = await vscode.window.showTextDocument(doc);
      const lineIndex = Math.max(0, pick.route.line - 1);
      const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(range.start, range.start);
    })
  );
}
