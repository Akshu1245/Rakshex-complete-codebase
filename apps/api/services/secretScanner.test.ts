// @ts-nocheck
import { describe, expect, it } from "vitest";
import { scanPullRequestFiles, scanText } from "./secretScanner";

describe("secretScanner.scanText", () => {
  it("detects AWS access keys", () => {
    const f = scanText('AWS_KEY="AKIAIOSFODNN7EXAMPLE"');
    expect(f.find((x) => x.ruleId === "aws_access_key")).toBeTruthy();
  });

  it("detects GitHub PATs", () => {
    const tok = "ghp_" + "a".repeat(40);
    const f = scanText(`token: ${tok}`);
    expect(f.find((x) => x.ruleId === "github_pat")).toBeTruthy();
  });

  it("detects OpenAI keys but not Anthropic keys with the OpenAI rule", () => {
    const text = `key1=sk-${"a".repeat(48)}\nkey2=sk-ant-${"b".repeat(50)}`;
    const f = scanText(text);
    const openai = f.filter((x) => x.ruleId === "openai_api_key");
    const anthropic = f.filter((x) => x.ruleId === "anthropic_api_key");
    expect(openai.length).toBe(1);
    expect(anthropic.length).toBe(1);
  });

  it("detects private key blocks", () => {
    const f = scanText("-----BEGIN RSA PRIVATE KEY-----\nMIIE...");
    expect(f.find((x) => x.ruleId === "private_key_block")).toBeTruthy();
  });

  it("does not flag normal english text", () => {
    const f = scanText("the quick brown fox jumps over the lazy dog");
    expect(f.length).toBe(0);
  });

  it("redacts the matched secret in the preview", () => {
    const f = scanText("OPENAI=sk-abcdefghijklmnopqrstuvwx");
    const finding = f.find((x) => x.ruleId === "openai_api_key");
    expect(finding?.matchPreview).not.toContain("abcdefghijkl");
    expect(finding?.matchPreview).toMatch(/^sk-a…/);
  });
});

describe("secretScanner.scanPullRequestFiles", () => {
  it("scans only added lines (lines prefixed with '+')", () => {
    const result = scanPullRequestFiles([
      {
        filename: "config.js",
        patch:
          "@@ -1,2 +1,3 @@\n const a = 1;\n+const KEY = 'sk-" +
          "x".repeat(48) +
          "';\n-removed line",
      },
    ]);
    expect(result.totalFindings).toBe(1);
    expect(result.findings[0]?.ruleId).toBe("openai_api_key");
    expect(result.findings[0]?.file).toBe("config.js");
  });

  it("does not scan removed lines", () => {
    const result = scanPullRequestFiles([
      {
        filename: "old.js",
        patch: "@@ -1,2 +1,1 @@\n-const KEY = 'sk-" + "x".repeat(48) + "';\n const x = 1;",
      },
    ]);
    expect(result.totalFindings).toBe(0);
  });
});
