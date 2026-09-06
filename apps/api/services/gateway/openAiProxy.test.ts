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

  it("extracts Chat Completions usage without trusting invalid values", () => {
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

  it("normalizes Responses usage into the gateway accounting shape", () => {
    expect(
      __test.extractUsage({
        usage: {
          input_tokens: 37,
          output_tokens: 11,
          total_tokens: 48,
          output_tokens_details: { reasoning_tokens: 4 },
        },
      }),
    ).toEqual({
      prompt_tokens: 37,
      completion_tokens: 11,
      total_tokens: 48,
      reasoning_tokens: 4,
    });
  });

  it("finds usage in Chat Completions SSE streams", () => {
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

  it("finds usage in the final Responses response.completed SSE event", () => {
    const completedEvent = {
      type: "response.completed",
      response: {
        status: "completed",
        usage: {
          input_tokens: 9,
          output_tokens: 5,
          total_tokens: 14,
          output_tokens_details: { reasoning_tokens: 2 },
        },
      },
    };
    const raw = [
      "event: response.output_text.delta",
      'data: {"type":"response.output_text.delta","delta":"hello"}',
      "",
      "event: response.completed",
      `data: ${JSON.stringify(completedEvent)}`,
      "",
    ].join("\n");

    expect(__test.extractStreamingUsage(raw)).toEqual({
      prompt_tokens: 9,
      completion_tokens: 5,
      total_tokens: 14,
      reasoning_tokens: 2,
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

  it("normalizes public compatible endpoints for both OpenAI surfaces", () => {
    expect(
      __test.normalizeUpstreamUrl("openai_compatible", {
        baseUrl: "https://llm.example.com/api",
      }),
    ).toBe("https://llm.example.com/api/v1/chat/completions");

    expect(
      __test.normalizeUpstreamUrl(
        "openai_compatible",
        { baseUrl: "https://llm.example.com/api/v1/chat/completions" },
        "responses",
      ),
    ).toBe("https://llm.example.com/api/v1/responses");

    expect(__test.normalizeUpstreamUrl("openai", {})).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(__test.normalizeUpstreamUrl("openai", {}, "responses")).toBe(
      "https://api.openai.com/v1/responses",
    );
  });

  it("pins OpenRouter to its public origin regardless of account metadata", () => {
    expect(
      __test.normalizeUpstreamUrl("openrouter", { baseUrl: "https://attacker.example.com" }),
    ).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("builds Azure OpenAI v1 URLs only for Microsoft-operated resource endpoints", () => {
    expect(
      __test.normalizeUpstreamUrl("azure_openai", {
        resourceEndpoint: "https://myresource.openai.azure.com",
      }),
    ).toBe("https://myresource.openai.azure.com/openai/v1/chat/completions");
    expect(
      __test.normalizeUpstreamUrl(
        "azure_openai",
        { resourceEndpoint: "https://myresource.services.ai.azure.com/" },
        "responses",
      ),
    ).toBe("https://myresource.services.ai.azure.com/openai/v1/responses");

    expect(() =>
      __test.normalizeUpstreamUrl("azure_openai", {
        resourceEndpoint: "https://evil.example.com",
      }),
    ).toThrow(/Azure OpenAI resource endpoint/);
    expect(() =>
      __test.normalizeUpstreamUrl("azure_openai", {
        resourceEndpoint: "http://myresource.openai.azure.com",
      }),
    ).toThrow(/Azure OpenAI resource endpoint/);
    expect(() =>
      __test.normalizeUpstreamUrl("azure_openai", {
        resourceEndpoint: "https://evil.example.com/#.openai.azure.com",
      }),
    ).toThrow(/Azure OpenAI resource endpoint/);
    expect(() => __test.normalizeUpstreamUrl("azure_openai", {})).toThrow(
      /missing metadata.resourceEndpoint/,
    );
  });

  it("validates Azure hostnames as suffixes, not substrings", () => {
    expect(__test.isAllowedAzureOpenAiHost("myres.openai.azure.com")).toBe(true);
    expect(__test.isAllowedAzureOpenAiHost("myres.cognitiveservices.azure.com")).toBe(true);
    expect(__test.isAllowedAzureOpenAiHost("openai.azure.com.evil.example")).toBe(false);
    expect(__test.isAllowedAzureOpenAiHost("fakeopenai.azure.com")).toBe(false);
  });

  it("restricts OpenRouter to Chat Completions", () => {
    expect(__test.providerSupportsEndpoint("openrouter", "chat/completions")).toBe(true);
    expect(__test.providerSupportsEndpoint("openrouter", "responses")).toBe(false);
    expect(__test.providerSupportsEndpoint("azure_openai", "responses")).toBe(true);
    expect(__test.providerSupportsEndpoint("openai", "responses")).toBe(true);
  });

  it("opts OpenRouter requests into usage accounting without touching other providers", () => {
    expect(
      __test.upstreamBodyForProvider("openrouter", "chat/completions", { model: "m" }),
    ).toEqual({ model: "m", usage: { include: true } });
    expect(__test.upstreamBodyForProvider("openai", "chat/completions", { model: "m" })).toEqual({
      model: "m",
    });
  });

  it("captures provider-reported cost from usage accounting", () => {
    expect(
      __test.extractUsage({
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8, cost: 0.00042 },
      }),
    ).toEqual({
      prompt_tokens: 5,
      completion_tokens: 3,
      total_tokens: 8,
      provider_reported_cost_usd: 0.00042,
    });
    expect(
      __test.extractUsage({
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8, cost: -1 },
      }),
    ).toEqual({ prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 });
  });

  it("strips trailing slashes from compatible base URLs in linear time", () => {
    expect(
      __test.normalizeUpstreamUrl("openai_compatible", {
        baseUrl: `https://llm.example.com/api${"/".repeat(10_000)}`,
      }),
    ).toBe("https://llm.example.com/api/v1/chat/completions");
  });

  it("maps Responses text inputs into preflight policy messages", () => {
    const normalized = __test.normalizeResponses({
      model: "gpt-5",
      instructions: "Do not expose secrets",
      input: "Summarize this record",
      stream: false,
    });

    expect(normalized.ok).toBe(true);
    if (!normalized.ok) throw new Error("expected normalized Responses request");
    expect(normalized.request.endpoint).toBe("responses");
    expect(normalized.request.policyMessages).toEqual([
      { role: "system", content: "Do not expose secrets" },
      { role: "user", content: "Summarize this record" },
    ]);
  });

  it("rejects background Responses until asynchronous usage settlement exists", () => {
    const normalized = __test.normalizeResponses({
      model: "gpt-5",
      input: "hello",
      background: true,
    });

    expect(normalized).toMatchObject({
      ok: false,
      status: 400,
      code: "unsupported_background",
    });
  });

  it("settles the reserved estimate after provider POST starts without verified usage", () => {
    expect(
      __test.settlementCostAfterProviderAttempt({
        providerFetchStarted: false,
        providerCompleted: false,
        completedCost: 0,
        estimatedCostUsd: 0.04,
      }),
    ).toBe(0);
    expect(
      __test.settlementCostAfterProviderAttempt({
        providerFetchStarted: true,
        providerCompleted: false,
        completedCost: 0,
        estimatedCostUsd: 0.04,
      }),
    ).toBe(0.04);
    expect(
      __test.settlementCostAfterProviderAttempt({
        providerFetchStarted: true,
        providerCompleted: true,
        completedCost: 0.012,
        estimatedCostUsd: 0.04,
      }),
    ).toBe(0.012);
  });
});
