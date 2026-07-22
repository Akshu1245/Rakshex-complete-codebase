import { describe, expect, it } from "vitest";
import { __test } from "./shadowKeyDetector";

describe("shadow key detector", () => {
  it("extracts supported leaked-key formats without persisting raw values", () => {
    const anthropic = `sk-ant-${"a".repeat(40)}`;
    const github = `ghp_${"A".repeat(36)}`;

    expect(
      __test.extractKeyFromFinding({
        title: "Secret detected",
        description: `credential=${anthropic}`,
      }),
    ).toBe(anthropic);
    expect(
      __test.extractKeyFromFinding({
        title: `Leaked ${github}`,
        description: null,
      }),
    ).toBe(github);
  });

  it("classifies Anthropic before the broader sk- OpenAI prefix", () => {
    expect(__test.detectProvider(`sk-ant-${"a".repeat(40)}`)).toBe("anthropic");
    expect(__test.detectProvider(`sk-${"A".repeat(30)}`)).toBe("openai");
  });
});
