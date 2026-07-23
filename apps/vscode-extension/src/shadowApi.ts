/**
 * VS Code wrapper for the shadow-API workspace scanner.
 *
 * Glue layer between the pure scanner (shadowApiScanner.ts) and the editor:
 *   - reads candidate files via vscode.workspace.findFiles
 *   - reads file contents via vscode.workspace.fs.readFile
 *   - optionally diffs against tracked collection inventory via RakshexApi
 *   - presents routes in an output channel and offers a quick-pick
 *
 * Patent surface NHCE/DEV/2026/003 (Shadow API Discovery via IDE Correlation).
 */
import * as vscode from "vscode";
import type { RakshexApi } from "./api";
import { detectRoutesInFile, findShadowRoutes, type DetectedRoute } from "./shadowApiScanner";

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
  const files = await vscode.workspace.findFiles(FILE_GLOB, EXCLUDE_GLOB, MAX_FILES);
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

/** Extract METHOD:path keys from Postman / OpenAPI collection `data`. */
export function extractTrackedEndpointKeys(data: unknown): string[] {
  const keys: string[] = [];
  if (!data || typeof data !== "object") return keys;
  const obj = data as Record<string, unknown>;

  // OpenAPI
  const paths = obj.paths;
  if (paths && typeof paths === "object") {
    for (const [p, methods] of Object.entries(paths as Record<string, unknown>)) {
      if (!methods || typeof methods !== "object") continue;
      for (const method of Object.keys(methods as object)) {
        const m = method.toUpperCase();
        if (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(m)) {
          keys.push(`${m}:${p}`);
        }
      }
    }
  }

  // Postman — walk item tree
  const walk = (items: unknown): void => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (Array.isArray(row.item)) walk(row.item);
      const req = row.request;
      if (!req || typeof req !== "object") continue;
      const r = req as Record<string, unknown>;
      const method = String(r.method || "GET").toUpperCase();
      let pathStr = "/";
      const url = r.url;
      if (typeof url === "string") {
        try {
          pathStr = url.startsWith("http") ? new URL(url).pathname : url;
        } catch {
          pathStr = url;
        }
      } else if (url && typeof url === "object") {
        const u = url as { path?: string[] | string; raw?: string };
        if (Array.isArray(u.path)) pathStr = "/" + u.path.join("/");
        else if (typeof u.path === "string")
          pathStr = u.path.startsWith("/") ? u.path : `/${u.path}`;
        else if (typeof u.raw === "string") {
          try {
            pathStr = u.raw.startsWith("http") ? new URL(u.raw).pathname : u.raw;
          } catch {
            pathStr = u.raw;
          }
        }
      }
      keys.push(`${method}:${pathStr}`);
    }
  };
  walk(obj.item);

  return keys;
}

async function loadTrackedKeys(api: RakshexApi | undefined): Promise<{
  keys: string[];
  inventoryAvailable: boolean;
}> {
  if (!api) return { keys: [], inventoryAvailable: false };
  try {
    const collections = await api.listCollections();
    if (collections.length === 0) return { keys: [], inventoryAvailable: false };

    const keys: string[] = [];
    for (const c of collections.slice(0, 10)) {
      try {
        const detail = await api.getCollection(c.id);
        keys.push(...extractTrackedEndpointKeys(detail.data));
      } catch {
        // Skip unreadable collections
      }
    }
    return { keys, inventoryAvailable: keys.length > 0 };
  } catch {
    return { keys: [], inventoryAvailable: false };
  }
}

export interface ShadowApiOptions {
  isTrusted: () => boolean;
  api?: RakshexApi;
  isSignedIn?: () => boolean;
}

export function registerShadowApiCommand(
  context: vscode.ExtensionContext,
  options?: ShadowApiOptions,
): void {
  const channel = vscode.window.createOutputChannel("Rakshex Shadow API");
  context.subscriptions.push(channel);

  context.subscriptions.push(
    vscode.commands.registerCommand("rakshex.scanShadowApis", async () => {
      if (options && !options.isTrusted()) {
        void vscode.window.showWarningMessage(
          "Rakshex: shadow API scanning requires a trusted workspace. Trust this workspace to enable scanning.",
        );
        return;
      }

      const detected = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Rakshex: scanning workspace for shadow APIs",
        },
        () => runShadowApiScan(),
      );

      const signedIn = options?.isSignedIn?.() ?? false;
      const { keys: trackedKeys, inventoryAvailable } =
        signedIn && options?.api
          ? await loadTrackedKeys(options.api)
          : { keys: [] as string[], inventoryAvailable: false };

      const shadowOnly = inventoryAvailable
        ? (findShadowRoutes(detected, trackedKeys) as DetectedWithUri[])
        : detected;

      // Prefer untracked routes when inventory exists; otherwise show all as candidates.
      const display = inventoryAvailable ? shadowOnly : detected;

      channel.clear();
      channel.appendLine(`# Rakshex Shadow API scan — ${new Date().toISOString()}`);
      if (inventoryAvailable) {
        channel.appendLine(
          `Inventory compare: ${trackedKeys.length} tracked endpoint key(s). Showing ${display.length} untracked (shadow) route(s) of ${detected.length} detected.`,
        );
      } else {
        channel.appendLine(
          `Detected routes (inventory compare unavailable — sign in + import collections for true shadow diff).`,
        );
        channel.appendLine(`Detected ${detected.length} HTTP route(s).`);
      }
      for (const r of display) {
        channel.appendLine(
          `${r.method.padEnd(7)} ${r.path.padEnd(40)} ${r.framework.padEnd(13)} ${vscode.workspace.asRelativePath(r.uri)}:${r.line}`,
        );
      }
      channel.show(true);

      if (detected.length === 0) {
        await vscode.window.showInformationMessage(
          "Rakshex: no HTTP routes detected in this workspace.",
        );
        return;
      }

      const placeHolder = inventoryAvailable
        ? `Found ${display.length} shadow (untracked) route(s) — select one to open`
        : `Detected ${display.length} routes (inventory compare unavailable) — select one to open`;

      const items = display.map((r) => ({
        label: `${r.method} ${r.path}`,
        description: `${r.framework} · ${vscode.workspace.asRelativePath(r.uri)}:${r.line}`,
        detail: r.snippet.slice(0, 120),
        route: r,
      }));
      const pick = await vscode.window.showQuickPick(items, { placeHolder });
      if (!pick) return;

      const doc = await vscode.workspace.openTextDocument(pick.route.uri);
      const editor = await vscode.window.showTextDocument(doc);
      const lineIndex = Math.max(0, pick.route.line - 1);
      const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(range.start, range.start);
    }),
  );
}
