import { describe, expect, it } from "vitest";
import { scanLocalText } from "./localDiscovery";

describe("local discovery", () => {
  it("finds provider credentials without returning plaintext", () => {
    const secret = `sk-ant-${"a".repeat(32)}`;
    const findings = scanLocalText(`ANTHROPIC_API_KEY=${secret}`, ".env");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.provider).toBe("anthropic");
    expect(findings[0]?.fingerprint).toHaveLength(64);
    expect(findings[0]?.maskedValue).toContain("...");
    expect(findings[0]?.maskedValue).not.toContain(secret);
  });

  it("detects SDK usage as low-severity metadata", () => {
    const findings = scanLocalText(`import OpenAI from "openai";`, "src/ai.ts");
    expect(
      findings.some((finding) => finding.kind === "sdk_usage" && finding.provider === "openai"),
    ).toBe(true);
    expect(findings.every((finding) => finding.severity === "low")).toBe(true);
  });
});
