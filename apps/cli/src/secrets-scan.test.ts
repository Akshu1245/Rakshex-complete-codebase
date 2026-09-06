import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanPathForSecrets } from "@rakshex/scanner-core";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "../fixtures/secrets-sample");

describe("rakshex secrets fixture", () => {
  it("finds planted high-confidence secrets", () => {
    const findings = scanPathForSecrets(fixtureDir);
    const ids = new Set(findings.map((f) => f.ruleId));
    expect(ids.has("secret.aws_access_key")).toBe(true);
    expect(ids.has("secret.openai_api_key")).toBe(true);
    expect(ids.has("secret.github_pat")).toBe(true);
    expect(ids.has("secret.stripe_live_key")).toBe(true);
    expect(ids.has("secret.slack_bot_token")).toBe(true);
    expect(findings.length).toBeGreaterThanOrEqual(5);
  });
});
