import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyMatch, scanTextForSecrets, scanPathForSecrets, placeholderSignals } from "./secrets.js";
// @ts-expect-error plain ESM helper
import { makeFixture } from "../bench/leakshield/make-fixture.mjs";

// Token-shaped strings are assembled at runtime so no credential-like literal is committed.
const j = (...p: string[]) => p.join("");
const RANDOM_BODY = "q8Zt3VnR0wLk5PbX2yHc9MdF4sJa7GeU";

describe("LeakShield truthful confidence", () => {
  it("never labels a regex match 'confirmed' and never claims verified_valid", () => {
    const f = scanTextForSecrets(j("const k = '", "sk", "_live_", RANDOM_BODY, "';"), "src/a.ts");
    expect(f).toHaveLength(1);
    expect(f[0]!.confidence).not.toBe("confirmed" as never);
    expect(f[0]!.state).toBe("likely_secret");
    expect(f[0]!.verification.ran).toBe(false);
  });

  it("placeholders are reported as pattern_match / low / Info, never Critical", () => {
    for (const body of ["0".repeat(32), "FAKEabcdabcdabcdabcdabcdabcd", "1234567890abcdefghijklmnopqrstuv", "EXAMPLEXXXXXXXXXXXXXXXXXXXXXXXXX"]) {
      const f = scanTextForSecrets(j("x = '", "sk", "_live_", body, "'"), "src/a.ts");
      expect(f[0]).toMatchObject({ state: "pattern_match", confidence: "low", severity: "Info", impactIfReal: "Critical" });
    }
  });

  it("separates impact from confidence: test paths lower confidence, not detection", () => {
    const line = j("k='", "gh", "p_", RANDOM_BODY, "abcd'");
    const prod = scanTextForSecrets(line, "src/x.ts")[0]!;
    const test = scanTextForSecrets(line, "tests/fixtures/x.ts")[0]!;
    expect(prod).toMatchObject({ impactIfReal: "Critical", severity: "Critical", confidence: "high" });
    expect(test).toMatchObject({ impactIfReal: "Critical", severity: "High", confidence: "medium" });
  });

  it("detects OpenAI project keys (sk-proj-…) that the legacy rule missed", () => {
    const f = scanTextForSecrets(j("OPENAI='", "sk", "-proj-", RANDOM_BODY, "-", RANDOM_BODY, "'"), "src/a.ts");
    expect(f.map((x) => x.ruleId)).toEqual(["secret.openai_project_key"]);
  });

  it("Stripe test-mode keys are Low impact", () => {
    const f = scanTextForSecrets(j("'", "sk", "_test_", RANDOM_BODY, "'"), "src/a.ts");
    expect(f[0]).toMatchObject({ ruleId: "secret.stripe_test_key", impactIfReal: "Low", severity: "Low" });
  });

  it("private key headers are pattern_match (no key material analysed)", () => {
    expect(classifyMatch({ impactIfReal: "Critical", prefix: 0, structural: true }, "", "", "src/k.pem").state).toBe("pattern_match");
  });

  it("placeholder signals", () => {
    expect(placeholderSignals("000000000000", "")).toContain("placeholder:repeated-run");
    expect(placeholderSignals(RANDOM_BODY, "")).toEqual([]);
  });

  it("synthetic multi-provider fixture: all random tokens found, zero placeholders above Info", () => {
    const dir = mkdtempSync(join(tmpdir(), "ls-"));
    try {
      const truth = makeFixture(dir) as { file: string; line: number; kind: string }[];
      const found = scanPathForSecrets(dir);
      const at = (t: { file: string; line: number }) => found.filter((f) => f.file === t.file && f.line === t.line);
      for (const t of truth.filter((t) => t.kind !== "placeholder")) expect(at(t).length, t.file).toBeGreaterThan(0);
      for (const t of truth.filter((t) => t.kind === "placeholder")) expect(at(t).every((f) => f.severity === "Info"), t.file).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
