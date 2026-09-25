import { describe, expect, it } from "vitest";
import {
  extractOpenAIThinkingTokens,
  estimateAnthropicThinkingTokens,
  estimateThinkingTokensFromLatency,
  extractThinkingTokensFromResponse,
  detectReasoningTokens,
  reasoningConfidenceFor,
  isReasoningAnomaly,
  buildReasoningSpendLineItem,
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

describe("reasoning detection cascade (DevPulse salvage)", () => {
  it("prefers the direct provider field", () => {
    const r = detectReasoningTokens({
      model: "o3",
      reportedReasoningTokens: 1200,
      totalTokens: 2000,
      inputTokens: 500,
      outputTokens: 300,
    });
    expect(r).toEqual({ tokens: 1200, method: "direct" });
    expect(reasoningConfidenceFor("direct")).toBe("exact");
  });

  it("falls back to differential total-input-output", () => {
    const r = detectReasoningTokens({
      model: "o3",
      totalTokens: 2000,
      inputTokens: 500,
      outputTokens: 300,
    });
    expect(r).toEqual({ tokens: 1200, method: "differential" });
    expect(reasoningConfidenceFor("differential")).toBe("estimated");
  });

  it("returns none when the numbers reconcile", () => {
    const r = detectReasoningTokens({
      model: "gpt-4o",
      totalTokens: 800,
      inputTokens: 500,
      outputTokens: 300,
    });
    expect(r).toEqual({ tokens: 0, method: "none" });
    expect(reasoningConfidenceFor("none")).toBe("unknown");
  });

  it("flags runaway reasoning above 3x output", () => {
    expect(isReasoningAnomaly(901, 300)).toBe(true);
    expect(isReasoningAnomaly(900, 300)).toBe(false);
    expect(isReasoningAnomaly(50, 0)).toBe(true);
  });

  it("builds a priced line item marked as a breakout, not new spend", () => {
    const item = buildReasoningSpendLineItem({
      model: "o3",
      reportedReasoningTokens: 1000,
      outputTokens: 500,
      outputPerMillionUsd: 40,
    });
    expect(item).not.toBeNull();
    expect(item!.kind).toBe("reasoning_spend");
    expect(item!.costUsd).toBeCloseTo(0.04, 6);
    expect(item!.confidence).toBe("exact");
    expect(item!.overheadMultiplier).toBeCloseTo(2, 6);
    expect(item!.isAnomaly).toBe(false);
    expect(item!.breakoutOfOutputTokens).toBe(true);
  });

  it("leaves costUsd null when no price is available", () => {
    const item = buildReasoningSpendLineItem({
      model: "o3",
      reportedReasoningTokens: 1000,
      outputTokens: 500,
    });
    expect(item!.costUsd).toBeNull();
    expect(item!.overheadMultiplier).toBeNull();
  });

  it("returns null when no reasoning detected", () => {
    expect(
      buildReasoningSpendLineItem({ model: "gpt-4o", outputTokens: 300 }),
    ).toBeNull();
  });
});
