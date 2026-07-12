import { describe, expect, it } from "vitest";
import {
  calculateCost,
  forecastSpend,
  labelExactCost,
  listPricingVersions,
  PRICING_CATALOG,
  recommendOptimizations,
  resolvePricingVersion,
} from "./index.js";

describe("pricing-engine", () => {
  it("resolves a versioned price and returns estimate label", () => {
    const cost = calculateCost({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      asOf: "2025-06-01",
    });
    expect(cost.kind).toBe("estimate");
    expect(cost.pricingVersionId).toMatch(/^pv_/);
    expect(cost.amountUsd).toBeCloseTo(0.15 + 0.6, 5);
    expect(cost.notes.some((n) => n.includes("estimate"))).toBe(true);
  });

  it("keeps historical costs stable after new prices", () => {
    const historical = calculateCost({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1_000_000,
      outputTokens: 0,
      asOf: "2024-06-01",
    });
    // As of June 2024, legacy row with effectiveTo 2024-08-01 and higher rate
    expect(historical.pricingVersionId).toBe("pv_openai_gpt4o_2024_05_legacy");
    expect(historical.amountUsd).toBeCloseTo(5, 5);

    const current = calculateCost({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1_000_000,
      outputTokens: 0,
      asOf: "2025-01-01",
    });
    expect(current.pricingVersionId).toBe("pv_openai_gpt4o_2024_05");
    expect(current.amountUsd).toBeCloseTo(2.5, 5);
  });

  it("applies cached token pricing", () => {
    const cost = calculateCost({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000_000,
      cachedInputTokens: 500_000,
      outputTokens: 0,
      asOf: "2025-01-01",
    });
    // 0.5M * 0.15/1M + 0.5M * 0.075/1M
    expect(cost.amountUsd).toBeCloseTo(0.075 + 0.0375, 5);
  });

  it("enterprise overrides take precedence", () => {
    const cost = calculateCost({
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 1_000_000,
      outputTokens: 0,
      asOf: "2025-01-01",
      enterpriseOverrides: [
        {
          id: "pv_ent_mini",
          provider: "openai",
          model: "gpt-4o-mini",
          effectiveFrom: "2025-01-01",
          effectiveTo: null,
          currency: "USD",
          inputPer1M: 0.05,
          outputPer1M: 0.2,
          enterpriseOverride: true,
        },
      ],
    });
    expect(cost.pricingVersionId).toBe("pv_ent_mini");
    expect(cost.amountUsd).toBeCloseTo(0.05, 5);
  });

  it("labels exact provider-reported costs", () => {
    const exact = labelExactCost(1.23, "pv_openai_gpt4o_2024_05");
    expect(exact.kind).toBe("exact");
    expect(exact.pricingVersionId).toBe("pv_openai_gpt4o_2024_05");
  });

  it("every catalog entry has id and effectiveFrom", () => {
    for (const v of listPricingVersions()) {
      expect(v.id).toBeTruthy();
      expect(v.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(PRICING_CATALOG.length).toBeGreaterThan(0);
  });

  it("forecasts period spend", () => {
    const f = forecastSpend(100, 10, 30);
    expect(f.dailyBurn).toBeCloseTo(10, 5);
    expect(f.projectedUsd).toBeCloseTo(300, 1);
  });

  it("emits optimization recommendations", () => {
    const usage = {
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 200_000,
      outputTokens: 10_000,
      cachedInputTokens: 0,
    };
    const cost = calculateCost(usage);
    const hints = recommendOptimizations(usage, cost);
    expect(hints.length).toBeGreaterThan(0);
  });

  it("resolvePricingVersion returns null for unknown model", () => {
    expect(
      resolvePricingVersion({ provider: "unknown", model: "nope", asOf: "2025-01-01" }),
    ).toBeNull();
  });
});
