import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliEntry = fileURLToPath(new URL("./index.ts", import.meta.url));
const requireFromApi = createRequire(new URL("../../api/package.json", import.meta.url));
const tsx = requireFromApi.resolve("tsx");
let tempDir: string;

function invoke(...args: string[]) {
  return spawnSync(process.execPath, ["--import", tsx, cliEntry, "api", ...args], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, HOME: tempDir, USERPROFILE: tempDir, RAKSHEX_API_KEY: "" },
  });
}

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), "rakshex-api-impact-process-"));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("api diff --impact-dir (real CLI)", () => {
  it("lists conservative affected file candidates for removed GET endpoints", () => {
    const oldFile = join(tempDir, "old.json");
    const newFile = join(tempDir, "new.json");
    const src = join(tempDir, "src");
    mkdirSync(src);
    const before = {
      openapi: "3.0.3",
      paths: {
        "/orders": { get: { responses: { "200": { description: "OK" } } } },
      },
    };
    writeFileSync(oldFile, JSON.stringify(before));
    writeFileSync(newFile, JSON.stringify({ openapi: "3.0.3", paths: {} }));
    writeFileSync(join(src, "client.ts"), 'await fetch("/orders");');
    const result = invoke("diff", oldFile, newFile, "--impact-dir", src, "--format", "json");
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.changes).toHaveLength(1);
    expect(output.impact.status).toBe("partial");
    expect(output.impact.matches).toEqual([
      expect.objectContaining({
        file: "client.ts",
        line: 1,
        method: "GET",
        path: "/orders",
        confidence: "candidate",
      }),
    ]);
  });

  it("fails clearly for missing or invalid source directories", () => {
    const oldFile = join(tempDir, "same-old.json");
    const newFile = join(tempDir, "same-new.json");
    const document = JSON.stringify({ openapi: "3.0.3", paths: {} });
    writeFileSync(oldFile, document);
    writeFileSync(newFile, document);
    expect(invoke("diff", oldFile, newFile, "--impact-dir").status).toBe(2);
    const result = invoke("diff", oldFile, newFile, "--impact-dir", join(tempDir, "missing"));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("api diff:");
    expect(result.stdout).toBe("");
  });

  it("preserves original JSON output without the new flag", () => {
    const oldFile = join(tempDir, "backward-old.json");
    const newFile = join(tempDir, "backward-new.json");
    const document = JSON.stringify({ openapi: "3.0.3", paths: {} });
    writeFileSync(oldFile, document);
    writeFileSync(newFile, document);
    const result = invoke("diff", oldFile, newFile, "--format", "json");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).not.toHaveProperty("impact");
  });
});
