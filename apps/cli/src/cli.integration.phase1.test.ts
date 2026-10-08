/** Runs the actual CLI process, unlike the unit suite that calls scanner-core directly.
 * No network, backend, database, or user credentials required.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const cli = fileURLToPath(new URL("./index.ts", import.meta.url));
// The existing monorepo declares tsx under @rakshex/api, not @rakshex/cli.
const requireFromApi = createRequire(new URL("../../api/package.json", import.meta.url));
const tsxModule = requireFromApi.resolve("tsx");
function fixture(name: string, body: string, args: string[] = []) {
  const temp = mkdtempSync(join(tmpdir(), "rakshex-cli-phase1-"));
  const file = join(temp, name);
  writeFileSync(file, body);
  const run = spawnSync(process.execPath, ["--import", tsxModule, cli, "scan", file, ...args], {
    cwd: dirname(cli),
    env: { ...process.env, HOME: temp, USERPROFILE: temp, RAKSHEX_API_KEY: "" },
    timeout: 30_000,
    maxBuffer: 1024 * 1024 * 5,
    encoding: "utf8",
  });
  rmSync(temp, { recursive: true, force: true });
  return run;
}

describe("Phase 1 CLI executable contract", () => {
  it("returns 0 with valid authenticated GET and JSON response", () => {
    const p = fixture(
      "clean.json",
      JSON.stringify({ paths: { "/status": { get: { security: [{ bearer: [] }] } } } }),
      ["--format", "json"],
    );
    expect(p.error).toBeUndefined();
    expect(p.status).toBe(0);
    expect(JSON.parse(p.stdout)).toMatchObject({ findings: [], score: 0 });
  });
  it("returns 1 with a finding and structured JSON", () => {
    const p = fixture("unsafe.json", JSON.stringify({ paths: { "/write": { post: {} } } }), [
      "--format",
      "json",
    ]);
    expect(p.status).toBe(1);
    expect(JSON.parse(p.stdout).findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "api.missing_authentication" })]),
    );
  });
  it("parses real YAML OpenAPI in ESM mode", () => {
    const p = fixture("unsafe.yaml", "openapi: 3.0.3\npaths:\n  /write:\n    post: {}\n", [
      "--format",
      "json",
    ]);
    expect(p.status).toBe(1);
    expect(
      JSON.parse(p.stdout).findings.some(
        (f: { ruleId: string }) => f.ruleId === "api.missing_authentication",
      ),
    ).toBe(true);
  });
  it("returns 2 for malformed JSON instead of a false green", () => {
    const p = fixture("broken.json", "{ unparseable", ["--format", "json"]);
    expect(p.status).toBe(2);
    expect(p.stderr).toContain("Invalid scan input");
  });
  it("returns 2 for empty file", () => {
    expect(fixture("empty.json", "", ["--format", "json"]).status).toBe(2);
  });
  it("returns 2 for invalid format", () => {
    expect(fixture("good.json", "{}", ["--format", "unknown"]).status).toBe(2);
  });
  it("produces SARIF 2.1.0 and includes a rule identifier", () => {
    const p = fixture("unsafe.json", JSON.stringify({ paths: { "/write": { post: {} } } }), [
      "--format",
      "sarif",
    ]);
    expect(p.status).toBe(1);
    const report = JSON.parse(p.stdout);
    expect(report.version).toBe("2.1.0");
    expect(report.runs[0].tool.driver.name).toBe("rakshex-cli");
    expect(report.runs[0].results).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: "api.missing_authentication" })]),
    );
  });
  it("accepts large but valid JSON without hanging", () => {
    const p = fixture(
      "large.json",
      JSON.stringify({ metadata: "x".repeat(10 * 1024 * 1024), paths: { "/health": { get: {} } } }),
      ["--format", "json"],
    );
    expect(p.error).toBeUndefined();
    expect(p.status).toBe(0);
  });
});
