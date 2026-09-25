/**
 * Evaluate DENY logic: spend-ceiling breach and unknown spend state must DENY.
 * Exercises the real evaluateAction from @rakshex/action-control plus the
 * workers-side buildSpendSoFar / mapReceiptEvent helpers.
 */
import { describe, expect, it } from "vitest";
import { evaluateAction, type EvaluationInput } from "@rakshex/action-control";
import { buildSpendSoFar, mapReceiptEvent } from "../src/routes/evaluate";

function baseInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    mode: "enforce",
    action: {
      name: "financial.refund",
      version: "0.1",
      domain: "financial",
      effect: "write",
      parameters: {},
      raw: { provider: "stripe", operation: "refund" },
      known: true,
    },
    authority: { actions: ["financial.*"] },
    policy: { version: "workers:0.1", spendCeilingsUsd: { agent: 5 } },
    estimatedCostUsd: 1.5,
    cumulative: { actionCount: 0, amountMinor: 0, spendSoFarUsd: { agent: 4 } },
    ...overrides,
  };
}

describe("spend ceiling enforcement", () => {
  it("DENYs when used + estimated exceeds the ceiling", () => {
    // 4.00 used + 1.50 estimated > 5.00 ceiling
    const result = evaluateAction(baseInput());
    expect(result.decision).toBe("DENY");
    expect(result.effectiveDecision).toBe("DENY");
    expect(result.wouldBlock).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/Spend ceiling exceeded/);
    expect(mapReceiptEvent(result.decision)).toBe("deny");
  });

  it("ALLOWs when spend stays under the ceiling", () => {
    const result = evaluateAction(
      baseInput({ cumulative: { actionCount: 0, amountMinor: 0, spendSoFarUsd: { agent: 1 } } }),
    );
    expect(result.decision).toBe("ALLOW");
    expect(mapReceiptEvent(result.decision)).toBe("allow");
  });

  it("DENYs fail-closed when spend state is unknown (null) for a capped scope", () => {
    const result = evaluateAction(
      baseInput({ cumulative: { actionCount: 0, amountMinor: 0, spendSoFarUsd: { agent: null } } }),
    );
    expect(result.decision).toBe("DENY");
    expect(result.reasons.join(" ")).toMatch(/Spend state unknown/);
  });

  it("DENYs when no authority is supplied", () => {
    const result = evaluateAction(baseInput({ authority: null }));
    expect(result.decision).toBe("DENY");
  });
});

describe("buildSpendSoFar", () => {
  it("returns undefined when no ceilings are configured", () => {
    expect(buildSpendSoFar({}, [], {})).toBeUndefined();
  });

  it("maps configured scopes to totals, null when the identity is missing", () => {
    const out = buildSpendSoFar(
      { agent: 5, user: 10 },
      [{ scope: "agent", total: 2.5 }],
      { agentId: "a1" }, // userId missing → null → gate must DENY
    );
    expect(out).toEqual({ agent: 2.5, user: null });
  });

  it("defaults a present identity with no rows to zero", () => {
    const out = buildSpendSoFar({ agent: 5 }, [], { agentId: "a1" });
    expect(out).toEqual({ agent: 0 });
  });
});
