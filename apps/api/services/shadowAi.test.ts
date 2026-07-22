import { describe, expect, it, vi } from "vitest";
import { __test, classifyShadowEvent, ingestShadowAiEvents } from "./shadowAi";

describe("shadow AI discovery", () => {
  it("normalizes hosts and avoids substring false positives", () => {
    expect(__test.normalizeHost("https://API.OPENAI.COM:443/v1/chat")).toBe("api.openai.com");
    expect(
      classifyShadowEvent(
        {
          userId: 1,
          source: "proxy",
          host: "api.openai.com.evil.example",
          model: "gpt-4o",
        },
        [],
      ).isLLMHost,
    ).toBe(false);
  });

  it("drops prompts, authorization, URLs, and arbitrary raw signal fields", () => {
    expect(
      __test.sanitizeRawSignals({
        method: "POST",
        service: "payments",
        prompt: "secret prompt",
        authorization: "Bearer secret",
        url: "https://api.openai.com/v1/chat?secret=x",
        unexpected: { nested: true },
      }),
    ).toEqual({ method: "POST", service: "payments" });
  });

  it("persists only sanitized metadata and classifies unsanctioned LLM traffic", async () => {
    const recordShadowAiEvent = vi.fn().mockResolvedValue(undefined);
    const summary = await ingestShadowAiEvents(
      {
        listAiAllowlist: vi.fn().mockResolvedValue([]),
        recordShadowAiEvent,
      },
      [
        {
          userId: 7,
          source: "egress",
          host: "https://api.anthropic.com/v1/messages",
          model: "claude-3-7-sonnet",
          raw: {
            method: "POST",
            environment: "production",
            prompt: "must-not-persist",
            apiKey: "must-not-persist",
          },
        },
      ],
    );

    expect(summary).toMatchObject({ total: 1, rogue: 1, allowlisted: 0 });
    expect(recordShadowAiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        detectedHost: "api.anthropic.com",
        severity: "high",
        rawSignals: { method: "POST", environment: "production" },
      }),
    );
  });
});
