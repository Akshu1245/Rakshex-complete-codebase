/**
 * Worst-case estimator tests: the math must be exact (a gate that cannot do
 * arithmetic is not a gate), unknown models must fail loudly, and the token
 * heuristic must stay labeled as what it is.
 */
import { describe, expect, it } from "vitest";
import {
  estimateInputTokensHeuristic,
  estimateWorstCaseCost,
  relabelEstimate,
} from "./estimator";
import { MODEL_PRICE_TABLE, PRICE_TABLE_VERSION, lookupModelPrice } from "./priceTable";

describe("estimateWorstCaseCost", () => {
  it("computes input*inRate + maxTokens*outRate (the bound, not a prediction)", () => {
    // gpt-4o-mini: 0.15 in / 0.60 out per 1M
    const e = estimateWorstCaseCost({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000,
      maxTokens: 500,
    });
    expect(e.costUsd).toBeCloseTo(0.00015 + 0.0003, 12);
    expect(e.outputTokens).toBe(500);
    expect(e.signalLabel).toBe("estimated");
    expect(e.priceTableVersion).toBe(PRICE_TABLE_VERSION);
  });

  it("scales linearly to large token counts", () => {
    const e = estimateWorstCaseCost({
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 200_000,
      maxTokens: 8_192,
    });
    expect(e.costUsd).toBeCloseTo(0.2 * 3 + (8192 / 1_000_000) * 15, 10);
  });

  it("throws on an unknown model so the gate can DENY fail-closed", () => {
    expect(() =>
      estimateWorstCaseCost({ provider: "openai", model: "gpt-9", inputTokens: 10, maxTokens: 10 }),
    ).toThrow(/No price entry/);
  });

  it("rejects negative or non-integer token counts", () => {
    expect(() =>
      estimateWorstCaseCost({ provider: "openai", model: "gpt-4o", inputTokens: -1, maxTokens: 10 }),
    ).toThrow(/non-negative integer/);
    expect(() =>
      estimateWorstCaseCost({ provider: "openai", model: "gpt-4o", inputTokens: 1.5, maxTokens: 10 }),
    ).toThrow(/non-negative integer/);
  });

  it("lookup is case-insensitive", () => {
    expect(lookupModelPrice("OpenAI", "GPT-4o")?.model).toBe("gpt-4o");
  });
});

describe("price table honesty", () => {
  it("marks every entry estimated — never exact", () => {
    expect(MODEL_PRICE_TABLE.length).toBeGreaterThanOrEqual(10);
    for (const entry of MODEL_PRICE_TABLE) {
      expect(entry.signalLabel).toBe("estimated");
      expect(entry.inputPerMillionUsd).toBeGreaterThan(0);
      expect(entry.outputPerMillionUsd).toBeGreaterThan(0);
    }
  });
});

describe("estimateInputTokensHeuristic", () => {
  it("uses ceil(chars/4) and labels it estimated", () => {
    const { tokens, signalLabel } = estimateInputTokensHeuristic("x".repeat(100));
    expect(tokens).toBe(25);
    expect(signalLabel).toBe("estimated");
  });

  it("never returns zero", () => {
    expect(estimateInputTokensHeuristic("").tokens).toBe(1);
  });
});

describe("relabelEstimate", () => {
  it("never upgrades an estimate to exact", () => {
    const e = estimateWorstCaseCost({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 10,
      maxTokens: 10,
    });
    expect(relabelEstimate(e, "exact").signalLabel).toBe("estimated");
    expect(relabelEstimate(e, "observed").signalLabel).toBe("observed");
    expect(relabelEstimate(e, "bogus").signalLabel).toBe("not_available");
  });
});
