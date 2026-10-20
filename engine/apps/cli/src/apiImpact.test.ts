import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { analyzeApiImpact } from "./apiImpact.js";

let root: string;

function source(path: string, code: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, code);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rakshex-api-impact-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("static API impact analysis", () => {
  it("finds GET fetch templates, Axios aliases, and method-scoped POST calls", () => {
    source(
      "src/requests.ts",
      [
        'import agent from "axios";',
        "export async function load(orderId: string) {",
        "  await fetch(`/orders/${orderId}`);",
        '  await agent.post("/orders", { amount: 20 });',
        '  await agent.get("https://api.example.com/orders/123?expand=true");',
        '  await fetch("/orders", { method: "POST" });',
        "}",
      ].join("\n"),
    );
    const report = analyzeApiImpact(root, [
      { id: "response-property-type-changed", operation: "GET", path: "/orders/{id}" },
      { kind: "required_request_property_added", method: "POST", path: "/orders" },
    ]);
    expect(report.matches).toHaveLength(4);
    expect(report.matches.map((m) => m.line)).toEqual([3, 4, 5, 6]);
    expect(report.matches.every((m) => m.confidence === "candidate")).toBe(true);
    expect(report.matches[0]).toMatchObject({
      rule: "response-property-type-changed",
      method: "GET",
      path: "/orders/{id}",
      file: "src/requests.ts",
      call: "fetch",
    });
    expect(report.changesWithoutMatches).toBe(0);
  });

  it("skips dependency trees, never treats unmatched verbs as hits, and counts dynamic calls", () => {
    source(
      "src/client.ts",
      [
        "fetch(buildUrl());",
        'fetch("/orders", { method: resolveMethod() });',
        'fetch("/orders", { method: "POST" });',
        'fetch("/other");',
      ].join("\n"),
    );
    source("node_modules/package/index.ts", 'fetch("/orders");');
    const report = analyzeApiImpact(root, [
      { kind: "operation_removed", method: "GET", path: "/orders" },
      { id: "unknown", path: "/orders" },
    ]);
    expect(report.filesScanned).toBe(1);
    expect(report.matches).toHaveLength(0);
    expect(report.dynamicCalls).toBe(2);
    expect(report.unlocatedChanges).toBe(1);
    expect(report.changesWithoutMatches).toBe(2);
    expect(report.scope).toContain("NOT proof of safety");
  });

  it("reports no matches as partial even for an empty project", () => {
    const report = analyzeApiImpact(root, [
      { kind: "operation_removed", method: "DELETE", path: "/users" },
    ]);
    expect(report.status).toBe("partial");
    expect(report.matches).toEqual([]);
    expect(report.changesWithoutMatches).toBe(1);
  });

  it("rejects non-directories, symlink roots, and overlarge files", () => {
    source("input.ts", 'fetch("/orders");');
    expect(() => analyzeApiImpact(join(root, "input.ts"), [])).toThrow(/directory/);
    const alias = join(root, "linked-root");
    symlinkSync(root, alias, "dir");
    expect(() => analyzeApiImpact(alias, [])).toThrow(/directory/);
    source("huge.ts", "x".repeat(1024 * 1024 + 1));
    expect(() => analyzeApiImpact(root, [])).toThrow(/size limit/);
  });

  it("does not follow symlink files or source directories", () => {
    source("real/client.ts", 'fetch("/orders");');
    symlinkSync(join(root, "real", "client.ts"), join(root, "link.ts"));
    symlinkSync(join(root, "real"), join(root, "linked"), "dir");
    const report = analyzeApiImpact(root, [
      { kind: "operation_removed", method: "GET", path: "/orders" },
    ]);
    expect(report.filesScanned).toBe(1);
    expect(report.matches).toHaveLength(1);
  });

  it("does not read imports outside the approved tree, including same-prefix siblings and symlinks", () => {
    const privateDir = root + "-private";
    const privateFile = join(privateDir, "secret.ts");
    const linkedFile = join(root, "external", "secret.ts");
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(privateFile, 'export const privateToken = "NEVER_READ_OUTSIDE_ROOT";');
    symlinkSync(privateDir, join(root, "external"), "dir");
    source("src/client.ts", [
      `import { privateToken as direct } from "../../${basename(privateDir)}/secret";`,
      'import { privateToken as linked } from "../external/secret";',
      "void direct; void linked;",
      'fetch("/orders");',
    ].join("\\n"));
    const seen: string[] = [];
    const readFile = ts.sys.readFile;
    const spy = vi.spyOn(ts.sys, "readFile").mockImplementation((path, encoding) => {
      seen.push(path);
      return readFile(path, encoding);
    });
    try {
      const report = analyzeApiImpact(root, [{ method: "GET", path: "/orders" }]);
      expect(report.filesScanned).toBe(1);
      expect(report.matches).toHaveLength(1);
      expect(seen).not.toContain(privateFile);
      expect(seen).not.toContain(linkedFile);
    } finally {
      spy.mockRestore();
      rmSync(privateDir, { recursive: true, force: true });
    }
  });
});
