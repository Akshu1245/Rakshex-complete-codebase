import { describe, expect, it } from "vitest";
import { calculatePrice, selectEffectivePrice, type PriceRate } from "./modelPriceRegistry";

const oldRate: PriceRate = {
  id: 1,
  provider: "openai",
  model: "fixture-model",
  inputPerMillion: 1,
  outputPerMillion: 2,
  cachedInputPerMillion: 0.1,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  sourceUrl: "https://example.invalid/old",
};

const newRate: PriceRate = {
  id: 2,
  provider: "openai",
  model: "fixture-model",
  inputPerMillion: 5,
  outputPerMillion: 8,
  cachedInputPerMillion: 0.5,
  effectiveFrom: new Date("2026-08-01T00:00:00Z"),
  sourceUrl: "https://example.invalid/new",
};

describe("versioned model price registry", () => {
  it("prices a historical call with the rate live at request time", () => {
    const versions = [oldRate, newRate];
    const historical = selectEffectivePrice(versions, new Date("2026-07-15T12:00:00Z"));
    const current = selectEffectivePrice(versions, new Date("2026-08-15T12:00:00Z"));

    expect(historical?.id).toBe(1);
    expect(current?.id).toBe(2);

    const usage = { inputTokens: 1_000_000, cachedInputTokens: 500_000, outputTokens: 100_000 };
    const historicalSettledCost = calculatePrice(historical!, usage);
    const currentCost = calculatePrice(current!, usage);

    expect(historicalSettledCost).toBeCloseTo(0.75, 10);
    expect(currentCost).toBeCloseTo(3.55, 10);
    // Adding a later version never changes the price selected for the old timestamp.
    expect(calculatePrice(selectEffectivePrice(versions, new Date("2026-07-15T12:00:00Z"))!, usage)).toBe(
      historicalSettledCost,
    );
  });

  it("charges cached input at the cached rate and never above input token count", () => {
    expect(
      calculatePrice(oldRate, {
        inputTokens: 100,
        cachedInputTokens: 500,
        outputTokens: 0,
      }),
    ).toBeCloseTo((100 * 0.1) / 1_000_000, 12);
  });

  it("returns no historical price when the registry did not yet have a live version", () => {
    expect(selectEffectivePrice([oldRate], new Date("2025-12-31T23:59:59Z"))).toBeUndefined();
  });
});
