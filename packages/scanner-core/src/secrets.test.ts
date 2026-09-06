import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanPathForSecrets, scanTextForSecrets, listSecretRuleIds } from "./secrets.js";

describe("secrets scanner", () => {
  it("lists high-confidence rules", () => {
    expect(listSecretRuleIds()).toContain("secret.aws_access_key");
    expect(listSecretRuleIds()).toContain("secret.openai_api_key");
  });

  it("finds planted secrets in text", () => {
    const sample = [
      "AWS_KEY=AKIAIOSFODNN7EXAMPLE",
      "OPENAI=sk-abcdefghijklmnopqrstuvwxyz012345",
      "GH=ghp_abcdefghijklmnopqrstuvwxyz0123456789AB",
      "-----BEGIN RSA PRIVATE KEY-----",
      "safe line",
    ].join("\n");
    const findings = scanTextForSecrets(sample, "fixture.env");
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain("secret.aws_access_key");
    expect(ids).toContain("secret.openai_api_key");
    expect(ids).toContain("secret.github_pat");
    expect(ids).toContain("secret.private_key_header");
    expect(findings.every((f) => f.preview.includes("…") || f.preview === "***")).toBe(true);
  });

  it("scans a fixture directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "rakshex-secrets-"));
    mkdirSync(join(dir, "src"));
    writeFileSync(
      join(dir, "src", "leak.ts"),
      'const key = "AKIAIOSFODNN7EXAMPLE";\nexport const x = 1;\n',
      "utf8",
    );
    writeFileSync(join(dir, ".env"), "STRIPE=sk_live_abcdefghijklmnopqrstuv\n", "utf8");
    const findings = scanPathForSecrets(dir);
    expect(findings.some((f) => f.ruleId === "secret.aws_access_key")).toBe(true);
    expect(findings.some((f) => f.ruleId === "secret.stripe_live_key")).toBe(true);
  });
});
