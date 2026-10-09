import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./index.ts", import.meta.url));
let temp: string;

function invoke(...args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", CLI, ...args], {
    encoding: "utf8",
    timeout: 20_000,
    env: { ...process.env, HOME: temp, USERPROFILE: temp, RAKSHEX_API_KEY: "" },
  });
}

beforeAll(() => {
  temp = mkdtempSync(join(tmpdir(), "rakshex-cli-"));
});
afterAll(() => {
  rmSync(temp, { recursive: true, force: true });
});

describe("real CLI process exit codes", () => {
  it("returns 0 and JSON for a clean collection", () => {
    const input = join(temp, "clean.json");
    writeFileSync(
      input,
      JSON.stringify({
        item: [{ request: { method: "GET", url: "https://example.test/status" } }],
      }),
    );
    const result = invoke("scan", input, "--format", "json");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).findings).toEqual([]);
  });

  it("returns 1 on policy findings and writes valid SARIF", () => {
    const input = join(temp, "insecure.json");
    const sarif = join(temp, "results.sarif");
    writeFileSync(
      input,
      JSON.stringify({
        item: [
          { request: { method: "GET", url: "http://example.test/orders?token=fake-test-value" } },
        ],
      }),
    );
    const result = invoke("scan", input, "--format", "sarif", "--out", sarif, "--fail-on", "High");
    expect(result.status).toBe(1);
    const report = JSON.parse(readFileSync(sarif, "utf8"));
    expect(report.version).toBe("2.1.0");
    expect(
      report.runs[0].results.some((r: { ruleId: string }) => r.ruleId === "api.insecure_http"),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain("fake-test-value");
  });

  it("returns 2 for invalid/missing file or invalid severity", () => {
    const input = join(temp, "broken.json");
    writeFileSync(input, "{not json");
    expect(invoke("scan", input).status).toBe(2);
    expect(invoke("scan", join(temp, "not-found.json")).status).toBe(2);
    expect(invoke("scan", input, "--fail-on", "Banana").status).toBe(2);
  });

  it("can override threshold for one invocation", () => {
    const input = join(temp, "warning.json");
    writeFileSync(
      input,
      JSON.stringify({ item: [{ request: { method: "GET", url: "http://example.test/a" } }] }),
    );
    expect(invoke("scan", input, "--format", "json", "--fail-on", "none").status).toBe(0);
    expect(invoke("scan", input, "--format", "json", "--fail-on", "High").status).toBe(1);
  });

  it("handles YAML specs through the real ESM CLI entrypoint", () => {
    const input = join(temp, "openapi.yaml");
    writeFileSync(input, "openapi: 3.0.3\npaths:\n  /create:\n    post: {}\n");
    const result = invoke("scan", input, "--format", "json", "--fail-on", "High");
    expect(result.status).toBe(1);
    expect(
      JSON.parse(result.stdout).findings.some(
        (f: { ruleId: string }) => f.ruleId === "api.missing_authentication",
      ),
    ).toBe(true);
  });

  it("rejects unimplemented changed-only rather than silently scanning the wrong set", () => {
    const input = join(temp, "changed.json");
    writeFileSync(input, JSON.stringify({ paths: { "/ping": { get: {} } } }));
    const result = invoke("scan", input, "--changed-only");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--changed-only is not implemented");
  });

  it("does not rewrite an existing baseline on comparison", () => {
    const input = join(temp, "baseline.json");
    writeFileSync(
      input,
      JSON.stringify({
        item: [{ request: { method: "GET", url: "http://example.test/baseline" } }],
      }),
    );
    const first = invoke("scan", input, "--baseline", "--fail-on", "none");
    expect(first.status).toBe(0);
    const baselinePath = join(temp, ".rakshex", "baseline.json");
    expect(existsSync(baselinePath)).toBe(true);
    const initial = readFileSync(baselinePath, "utf8");
    const second = invoke("scan", input, "--baseline", "--format", "json");
    expect(second.status).toBe(0);
    expect(JSON.parse(second.stdout).findings).toEqual([]);
    expect(readFileSync(baselinePath, "utf8")).toBe(initial);
  });

  it("does not attempt to scan unrelated package.json when given a directory", () => {
    const directory = join(temp, "directory");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), '{"name":"not-a-spec"}');
    writeFileSync(
      join(directory, "openapi.json"),
      JSON.stringify({ paths: { "/health": { get: {} } } }),
    );
    const result = invoke("scan", directory, "--format", "json", "--fail-on", "none");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).findings).toBeInstanceOf(Array);
  });
});
