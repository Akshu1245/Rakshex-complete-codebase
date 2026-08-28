import { describe, expect, it } from "vitest";
import {
  extractOpenAIThinkingTokens,
  estimateAnthropicThinkingTokens,
  estimateThinkingTokensFromLatency,
  extractThinkingTokensFromResponse,
} from "./thinkingTokens";

describe("thinking token extraction", () => {
  it("extracts OpenAI reasoning tokens and nets them out of completion", () => {
    const r = extractOpenAIThinkingTokens({
      usage: { completion_tokens: 500, completion_tokens_details: { reasoning_tokens: 300 } },
    });
    expect(r.reasoningTokens).toBe(300);
    expect(r.completionTokens).toBe(200);
  });

  it("estimates Anthropic thinking tokens from thinking blocks (not cache tokens)", () => {
    const thinkingText = "x".repeat(250); // ~100 tokens at 2.5 chars/token
    const r = estimateAnthropicThinkingTokens({
      content: [
        { type: "thinking", thinking: thinkingText },
        { type: "text", text: "hello" },
      ],
      usage: { output_tokens: 120, cache_read_input_tokens: 9999 },
    });
    expect(r.thinkingTokens).toBe(100);
    // cache_read_input_tokens must NOT leak into thinking tokens
    expect(r.thinkingTokens).not.toBe(9999);
  });

  it("dispatches by model name", () => {
    const claude = extractThinkingTokensFromResponse("claude-3-7-sonnet", {
      content: [{ type: "thinking", thinking: "yz".repeat(50) }],
      usage: { output_tokens: 10 },
    });
    expect(claude.reasoningTokens).toBeGreaterThan(0);
  });
});

describe("latency-based thinking estimation", () => {
  it("returns 0 when latency is explained by visible tokens", () => {
    // 100 tokens at 40 tps ≈ 2500ms expected; 2600ms actual → excess 100ms < floor
    expect(
      estimateThinkingTokensFromLatency({ latencyMs: 2600, visibleCompletionTokens: 100 }),
    ).toBe(0);
  });

  it("attributes clear excess latency to hidden reasoning tokens", () => {
    // 10 visible tokens ≈ 250ms expected; 10250ms actual → ~10s excess → ~400 tokens
    const est = estimateThinkingTokensFromLatency({
      latencyMs: 10250,
      visibleCompletionTokens: 10,
    });
    expect(est).toBeGreaterThan(300);
  });

  it("returns 0 for non-positive latency", () => {
    expect(estimateThinkingTokensFromLatency({ latencyMs: 0, visibleCompletionTokens: 10 })).toBe(
      0,
    );
  });
});
