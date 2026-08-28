import { describe, expect, it } from "vitest";
import { EVALUATION_PLANS, evaluationPlanById } from "./billingCatalog";

describe("evaluation billing catalog", () => {
  it("exposes visible private-beta prices for free, pro, and enterprise", () => {
    const ids = EVALUATION_PLANS.map((p) => p.id);
    expect(ids).toEqual(["free", "pro", "enterprise"]);

    expect(evaluationPlanById("free").usdAmount).toBe(0);
    expect(evaluationPlanById("pro").usdAmount).toBe(9900);
    expect(evaluationPlanById("enterprise").usdAmount).toBe(49900);

    expect(evaluationPlanById("pro").amount).toBe(829900);
    expect(evaluationPlanById("enterprise").amount).toBe(4159900);
  });

  it("includes feature lists so cards can render without a network fetch", () => {
    for (const plan of EVALUATION_PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });
});
