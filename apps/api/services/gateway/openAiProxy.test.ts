import { describe, expect, it } from "vitest";
import { __test } from "./openAiProxy";

describe("OpenAI-compatible enforcement gateway helpers", () => {
  it("uses a conservative preflight estimate including the output cap", () => {
    const estimate = __test.estimatePreflight({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 2_000,
      stream: false,
    });

    expect(estimate.estimatedTokens).toBeGreaterThanOrEqual(2_000);
    expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("extracts standard and reasoning usage without trusting invalid values", () => {
    expect(
      __test.extractUsage({
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
          completion_tokens_details: { reasoning_tokens: 3 },
        },
      }),
    ).toEqual({
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18,
      reasoning_tokens: 3,
    });

    expect(__test.extractUsage({ usage: { prompt_tokens: "not-a-number" } })).toBeUndefined();
  });

  it("finds usage in OpenAI SSE streams", () => {
    const raw = [
      'data: {"id":"one","choices":[{"delta":{"content":"hi"}}]}',
      "",
      'data: {"id":"one","choices":[],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}',
      "",
      "data: [DONE]",
    ].join("\n");

    expect(__test.extractStreamingUsage(raw)).toEqual({
      prompt_tokens: 4,
      completion_tokens: 2,
      total_tokens: 6,
    });
  });

  it("blocks private OpenAI-compatible targets and requires HTTPS", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "10.0.0.8",
      "172.16.0.2",
      "192.168.1.4",
      "169.254.169.254",
    ]) {
      expect(__test.isBlockedUpstreamHost(host)).toBe(true);
    }

    expect(() =>
      __test.normalizeUpstreamUrl("openai_compatible", {
        baseUrl: "http://127.0.0.1:8080",
      }),
    ).toThrow(/public HTTPS/);
  });

  it("normalizes public compatible endpoints to chat completions", () => {
    expect(
      __test.normalizeUpstreamUrl("openai_compatible", {
        baseUrl: "https://llm.example.com/api",
      }),
    ).toBe("https://llm.example.com/api/v1/chat/completions");

    expect(__test.normalizeUpstreamUrl("openai", {})).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });
});
