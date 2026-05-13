import { describe, it, expect } from "vitest";
import { calculateCost } from "./cost.js";

describe("calculateCost", () => {
  it("returns exact cost for known model gpt-4o", () => {
    const result = calculateCost("gpt-4o", 1000, 1000);
    expect(result.priceMatched).toBe(true);
    expect(result.costUsd).toBeCloseTo(0.0125, 5); // $0.0025 + $0.01
  });

  it("returns cost for gpt-4o-mini", () => {
    const result = calculateCost("gpt-4o-mini", 5000, 2000);
    expect(result.priceMatched).toBe(true);
    // (5000/1000)*0.00015 + (2000/1000)*0.0006 = 0.00075 + 0.0012 = 0.00195
    expect(result.costUsd).toBeCloseTo(0.00195, 6);
  });

  it("accounts for cached input tokens with discount", () => {
    const result = calculateCost("gpt-4o", 5000, 2000, 3000);
    // cached: (3000/1000)*0.00125 = 0.00375
    // remaining input: (2000/1000)*0.0025 = 0.005
    // output: (2000/1000)*0.01 = 0.02
    // total = 0.02875
    expect(result.costUsd).toBeCloseTo(0.02875, 5);
  });

  it("fuzzy-matches claude-3.5-sonnet", () => {
    const result = calculateCost("claude-3-5-sonnet-20241022-v1", 1000, 500);
    expect(result.priceMatched).toBe(false); // not exact, fuzzy match
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it("uses fallback pricing for unknown models", () => {
    const result = calculateCost("some-future-model", 10000, 10000);
    expect(result.priceMatched).toBe(false);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it("returns zero cost for zero tokens", () => {
    const result = calculateCost("gpt-4o", 0, 0);
    expect(result.costUsd).toBe(0);
  });

  it("handles claude-sonnet-4 pricing", () => {
    const result = calculateCost("claude-sonnet-4-20250514", 1000, 1000);
    expect(result.priceMatched).toBe(true);
    expect(result.costUsd).toBeCloseTo(0.018, 4); // $0.003 + $0.015
  });
});
