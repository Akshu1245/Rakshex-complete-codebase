import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliEntry = fileURLToPath(new URL("./index.ts", import.meta.url));
const requireFromApi = createRequire(new URL("../../api/package.json", import.meta.url));
const tsx = requireFromApi.resolve("tsx");
let tempDir: string;

function writeFixture(name: string, contents: string): string {
  const path = join(tempDir, name);
  writeFileSync(path, contents);
  return path;
}

function invoke(...args: string[]) {
  return spawnSync(process.execPath, ["--import", tsx, cliEntry, "api", ...args], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, HOME: tempDir, USERPROFILE: tempDir, RAKSHEX_API_KEY: "" },
  });
}

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), "rakshex-api-diff-"));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("rakshex api diff (real CLI process)", () => {
  it("detects a removed operation when comparing YAML to JSON", () => {
    const before = writeFixture(
      "old.yaml",
      "openapi: 3.0.3\npaths:\n  /orders:\n    get:\n      responses:\n        \"200\":\n          description: OK\n",
    );
    const after = writeFixture("new.json", JSON.stringify({ openapi: "3.0.3", paths: {} }));
    const result = invoke("diff", before, after, "--format", "json");
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout) as {
      breaking: boolean;
      changes: Array<{ kind: string; method: string; path: string }>;
      scope: string;
    };
    expect(report.breaking).toBe(true);
    expect(report.changes).toEqual([
      expect.objectContaining({ kind: "operation_removed", method: "GET", path: "/orders" }),
    ]);
    expect(report.scope).toContain("NOT proof");
  });

  it("reports partial coverage even when no supported changes are detected", () => {
    const unchanged = writeFixture(
      "unchanged.json",
      JSON.stringify({
        openapi: "3.0.3",
        paths: { "/status": { get: { responses: { "200": { description: "OK" } } } } },
      }),
    );
    const result = invoke("diff", unchanged, unchanged);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0 supported breaking change(s)");
    expect(result.stdout).toContain("NOT proof of compatibility");
  });

  it("fails explicitly on unsupported unresolved references", () => {
    const before = writeFixture(
      "old-ref.json",
      JSON.stringify({
        openapi: "3.0.3",
        paths: { "/orders": { get: { responses: { "200": { description: "OK" } } } } },
      }),
    );
    const after = writeFixture(
      "new-ref.json",
      JSON.stringify({
        openapi: "3.0.3",
        paths: { "/orders": { get: { $ref: "#/components/operations/getOrders" } } },
      }),
    );
    const result = invoke("diff", before, after);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unsupported unresolved");
  });

  it("rejects invalid usage, format and unrelated JSON", () => {
    const unrelated = writeFixture("not-openapi.json", JSON.stringify({ message: "hi" }));
    const good = writeFixture("good.json", JSON.stringify({ openapi: "3.0.3", paths: {} }));
    expect(invoke("diff", unrelated, good).status).toBe(2);
    expect(invoke("diff", good, good, "--format", "yaml").status).toBe(2);
    expect(invoke("diff", good).status).toBe(2);
  });

  it("does not echo invalid input contents in parser errors", () => {
    const invalid = writeFixture("invalid.json", "{invalid SECRET-DO-NOT-PRINT");
    const good = writeFixture("valid.json", JSON.stringify({ openapi: "3.0.3", paths: {} }));
    const result = invoke("diff", invalid, good);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Invalid OpenAPI JSON/YAML");
    expect(result.stderr).not.toContain("SECRET-DO-NOT-PRINT");
  });
});
