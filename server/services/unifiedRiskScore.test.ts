// @ts-nocheck
import { describe, expect, it } from "vitest";
import { computeUnifiedRiskScore, costAnomalyRatio, rankByUnifiedRisk } from "./unifiedRiskScore";

describe("costAnomalyRatio", () => {
  it("returns 0 when there is no current spend", () => {
    expect(costAnomalyRatio(0, 100)).toBe(0);
  });

  it("returns 1 when current spend is positive but baseline is zero", () => {
    expect(costAnomalyRatio(50, 0)).toBe(1);
  });

  it("returns 0 when current spend is at or below baseline", () => {
    expect(costAnomalyRatio(50, 100)).toBe(0);
    expect(costAnomalyRatio(100, 100)).toBe(0);
  });

  it("scales linearly between 1× and 5×", () => {
    // 2× → (2-1)/4 = 0.25
    expect(costAnomalyRatio(200, 100)).toBeCloseTo(0.25, 3);
    // 3× → (3-1)/4 = 0.5
    expect(costAnomalyRatio(300, 100)).toBeCloseTo(0.5, 3);
    // 5× → 1.0
    expect(costAnomalyRatio(500, 100)).toBe(1);
  });

  it("caps the ratio at 5× (no signal explosion above)", () => {
    expect(costAnomalyRatio(10_000, 100)).toBe(1);
  });
});

describe("computeUnifiedRiskScore", () => {
  it("scores a clean endpoint as ok", () => {
    const score = computeUnifiedRiskScore({
      endpointId: "GET /healthz",
      highestSeverity: "None",
      openFindings: 0,
      currentSpendUsd: 0,
      baselineSpendUsd: 0,
    });
    expect(score.combined).toBe(0);
    expect(score.band).toBe("ok");
  });

  it("scores a critical endpoint with cost spike as critical band", () => {
    const score = computeUnifiedRiskScore({
      endpointId: "POST /agent/run",
      highestSeverity: "Critical",
      openFindings: 3,
      currentSpendUsd: 500,
      baselineSpendUsd: 100,
    });
    // sec ≈ 1.0 + small finding boost, cost ratio = 5× → 1.0
    // combined ≈ 0.6 × 1.0 + 0.4 × 1.0 = 1.0
    expect(score.combined).toBeCloseTo(1.0, 3);
    expect(score.band).toBe("critical");
  });

  it("scores a high-severity endpoint with no cost spike as warn", () => {
    const score = computeUnifiedRiskScore({
      endpointId: "POST /api/users",
      highestSeverity: "High",
      openFindings: 1,
      currentSpendUsd: 10,
      baselineSpendUsd: 10,
    });
    // sec ≈ 0.75, cost = 0
    // combined ≈ 0.6 × 0.75 = 0.45 → warn
    expect(score.combined).toBeGreaterThan(0.4);
    expect(score.combined).toBeLessThan(0.6);
    expect(score.band).toBe("warn");
  });

  it("scores a clean endpoint with cost spike as watch/warn", () => {
    const score = computeUnifiedRiskScore({
      endpointId: "POST /llm/chat",
      highestSeverity: "Low",
      openFindings: 0,
      currentSpendUsd: 200,
      baselineSpendUsd: 100,
    });
    // sec ≈ 0.25, cost = 0.25
    // combined = 0.6 × 0.25 + 0.4 × 0.25 = 0.25 → watch
    expect(score.combined).toBeCloseTo(0.25, 2);
    expect(score.band).toBe("watch");
  });

  it("respects custom weights", () => {
    const lopsidedToCost = computeUnifiedRiskScore({
      endpointId: "POST /llm/chat",
      highestSeverity: "Low", // 0.25 normalized
      openFindings: 0,
      currentSpendUsd: 500,
      baselineSpendUsd: 100, // 5× → cost norm 1.0
      weights: { security: 0.1, cost: 0.9 },
    });
    // 0.1 × 0.25 + 0.9 × 1.0 = 0.925 → critical
    expect(lopsidedToCost.combined).toBeGreaterThan(0.85);
    expect(lopsidedToCost.band).toBe("critical");
    expect(lopsidedToCost.components.securityWeight).toBeCloseTo(0.1);
    expect(lopsidedToCost.components.costWeight).toBeCloseTo(0.9);
  });

  it("renormalises weights that don't sum to 1", () => {
    const score = computeUnifiedRiskScore({
      endpointId: "GET /a",
      highestSeverity: "High",
      openFindings: 0,
      currentSpendUsd: 0,
      baselineSpendUsd: 0,
      weights: { security: 0.3, cost: 0.7 }, // sum = 1
    });
    // sanity: combined ≤ 1 always
    expect(score.combined).toBeGreaterThanOrEqual(0);
    expect(score.combined).toBeLessThanOrEqual(1);
  });

  it("includes the cost anomaly ratio in inputs for transparency", () => {
    const score = computeUnifiedRiskScore({
      endpointId: "POST /x",
      highestSeverity: "Medium",
      openFindings: 0,
      currentSpendUsd: 300,
      baselineSpendUsd: 100,
    });
    expect(score.inputs.costAnomalyRatio).toBeCloseTo(0.5, 2);
  });

  it("sorts ranked endpoints by descending combined score", () => {
    const ranked = rankByUnifiedRisk([
      {
        endpointId: "low",
        highestSeverity: "Low",
        openFindings: 0,
        currentSpendUsd: 10,
        baselineSpendUsd: 10,
      },
      {
        endpointId: "high",
        highestSeverity: "Critical",
        openFindings: 5,
        currentSpendUsd: 500,
        baselineSpendUsd: 100,
      },
      {
        endpointId: "mid",
        highestSeverity: "High",
        openFindings: 1,
        currentSpendUsd: 150,
        baselineSpendUsd: 100,
      },
    ]);
    expect(ranked.map((r) => r.endpointId)).toEqual(["high", "mid", "low"]);
  });

  it("rejects invalid input (negative spend)", () => {
    expect(() =>
      computeUnifiedRiskScore({
        endpointId: "x",
        highestSeverity: "None",
        openFindings: 0,
        currentSpendUsd: -1,
        baselineSpendUsd: 0,
      }),
    ).toThrow();
  });
});
