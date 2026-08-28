import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(apiDir, "../..");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "test"].includes(entry.name)) return [];
      return sourceFiles(target);
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\./.test(entry.name)) return [];
    return [target];
  });
}

function hasProcedure(procedurePath: string): boolean {
  let node: any = (appRouter as any)._def.record;
  for (const part of procedurePath.split(".")) {
    node = node?.[part];
    if (!node) return false;
    if (node._def?.record) node = node._def.record;
  }
  return Boolean(node?._def?.procedure);
}

describe("client-to-server tRPC contracts", () => {
  it("every web hook points to an implemented procedure", () => {
    const used = new Set<string>();
    for (const file of sourceFiles(path.join(repoRoot, "apps/web"))) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /\btrpc\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\.(?:useQuery|useMutation|useInfiniteQuery)\b/g,
      )) {
        used.add(`${match[1]}.${match[2]}`);
      }
    }
    const missing = [...used].filter((procedure) => !hasProcedure(procedure)).sort();
    expect(missing, `Missing web tRPC procedures: ${missing.join(", ")}`).toEqual([]);
  });

  it("every VS Code API call points to an implemented procedure", () => {
    const source = fs.readFileSync(path.join(repoRoot, "apps/vscode-extension/src/api.ts"), "utf8");
    const used = new Set<string>();
    for (const match of source.matchAll(
      /this\.(?:query|mutate)(?:<[^>]+>)?\(\s*["']([A-Za-z0-9_.]+)["']/g,
    )) {
      used.add(match[1]);
    }
    const missing = [...used].filter((procedure) => !hasProcedure(procedure)).sort();
    expect(missing, `Missing VS Code tRPC procedures: ${missing.join(", ")}`).toEqual([]);
  });

  it("registers the P0 billing checksum and signed receipt export procedures", () => {
    expect(hasProcedure("providerBilling.trackingRule")).toBe(true);
    expect(hasProcedure("providerBilling.connectionStatus")).toBe(true);
    expect(hasProcedure("providerBilling.connectOpenAiKey")).toBe(true);
    expect(hasProcedure("providerBilling.revokeOpenAiKey")).toBe(true);
    expect(hasProcedure("actionReceipts.exportJson")).toBe(true);
    expect(hasProcedure("actionReceipts.exportPdf")).toBe(true);
  });
});
