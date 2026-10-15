/** `rakshex secrets` CI gate: policy + reviewable allowlist. Token-shaped values are generated at test time. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { scanPathForSecrets } from "@rakshex/scanner-core";
import { cmdSecrets } from "./secrets.js";

const AN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const rand = (n: number) => Array.from(randomBytes(n), (b) => AN[b % AN.length]).join("");
const j = (...p: string[]) => p.join("");

let dir: string;
let out: string[];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ls-gate-"));
  out = [];
  vi.spyOn(console, "log").mockImplementation((...a) => {
    out.push(a.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...a) => {
    out.push(a.join(" "));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

const writeAllow = (entries: unknown[]) => {
  mkdirSync(join(dir, ".rakshex"), { recursive: true });
  writeFileSync(join(dir, ".rakshex", "secrets-allowlist.json"), JSON.stringify({ entries }));
};
const review = {
  justification: "value revoked at provider on 2026-10-01",
  owner: "payments",
  reviewed_by: "akshay",
  created: new Date().toISOString().slice(0, 10),
};
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

describe("rakshex secrets gate", () => {
  it("fails on a plausible Critical even in a test dir with a 'fake example' comment", () => {
    mkdirSync(join(dir, "tests"));
    writeFileSync(
      join(dir, "tests", "a.test.ts"),
      `const k = "${j("sk", "_live_")}${rand(10)}example${rand(14)}"; // fake example key\n`,
    );
    expect(cmdSecrets([dir], {})).toBe(1);
    expect(out.join("\n")).toMatch(/\[FAIL\] \[Critical \| plausible_credential/);
  });

  it("passes when only demonstrably synthetic placeholders / known docs dummies are present (reported as Info)", () => {
    writeFileSync(
      join(dir, "a.ts"),
      `a="${j("sk", "_live_")}${"x".repeat(32)}"\nb="${j("AK", "IA", "IOSFODNN7", "EXAMPLE")}"\n`,
    );
    expect(cmdSecrets([dir], {})).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/synthetic_placeholder/);
    expect(text).toMatch(/known_dummy/);
  });

  it("valid allowlist entry (value hash) turns the failure into an auditable ALLOWLISTED decision", () => {
    writeFileSync(join(dir, "a.ts"), `k="${j("gh", "p_")}${rand(36)}"\n`);
    const [f] = scanPathForSecrets(dir);
    writeAllow([
      { id: "LS-7", match: { value_sha256: f!.value_sha256 }, expires: inDays(30), ...review },
    ]);
    expect(cmdSecrets([dir], {})).toBe(0);
    expect(out.join("\n")).toMatch(/ALLOWLISTED LS-7 \(owner payments/);
  });

  it("expired allowlist entry is ignored and the gate fails again", () => {
    writeFileSync(join(dir, "a.ts"), `k="${j("gh", "p_")}${rand(36)}"\n`);
    const [f] = scanPathForSecrets(dir);
    writeAllow([
      {
        id: "LS-8",
        match: { location_fingerprint: f!.location_fingerprint },
        ...review,
        created: inDays(-60),
        expires: inDays(-1),
      },
    ]);
    expect(cmdSecrets([dir], {})).toBe(1);
    expect(out.join("\n")).toMatch(/LS-8 expired/);
  });

  it("malformed allowlist entry is reported and not applied", () => {
    writeFileSync(join(dir, "a.ts"), `k="${j("gh", "p_")}${rand(36)}"\n`);
    const [f] = scanPathForSecrets(dir);
    writeAllow([
      {
        id: "LS-9",
        match: { value_sha256: f!.value_sha256 },
        expires: inDays(30),
        owner: "x",
        reviewed_by: "y",
        created: review.created,
        justification: "",
      },
    ]);
    expect(cmdSecrets([dir], {})).toBe(1);
    expect(out.join("\n")).toMatch(
      /allowlist error: allowlist\[0\] \(LS-9\): justification required/,
    );
  });

  it("policy file can relax or tighten failOn; JSON output carries all classification fields and no raw value", () => {
    const v = j("sk", "_live_") + rand(32);
    writeFileSync(join(dir, "a.ts"), `k="${v}"\n`);
    mkdirSync(join(dir, ".rakshex"), { recursive: true });
    writeFileSync(join(dir, ".rakshex", "secrets-policy.json"), JSON.stringify({ failOn: [] }));
    expect(cmdSecrets([dir], { format: "json" })).toBe(0);
    const json = out.join("\n");
    expect(json).not.toContain(v);
    const r = JSON.parse(json);
    expect(r.findings[0]).toMatchObject({
      detection_confidence: "high",
      potential_impact: "Critical",
      verification_status: "not_verified",
      classification: "plausible_credential",
      gate: "pass",
    });
  });
});
