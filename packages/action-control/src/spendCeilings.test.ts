/**
 * Real-time spend-ceiling enforcement tests (Team B, enforcement parity).
 *
 * evaluateAction() is the gate: ceilings here are a hard DENY, and a
 * configured ceiling with unknown spend state must DENY fail-closed rather
 * than allow blind.
 */
import { describe, expect, it } from "vitest";
import { evaluateAction, normalizeSemanticAction } from "./index";
import type { AuthorityScope, ControlPolicy } from "./types";

// The spend gate does not depend on the action domain, only on ceiling math,
// so the tests use a known catalog action to isolate the spend branch from the
// unknown-action restrictive path.
const call = () =>
  normalizeSemanticAction({
    provider: "stripe",
    operation: "payment_intents.create",
    resource: "customer:1827",
    environment: "production",
    amountMinor: 100_000,
    currency: "INR",
  });

const authority: AuthorityScope = {
  actions: ["financial.*"],
  resources: ["customer:*"],
  environments: ["production"],
};

const policyWithCeiling = (over: Partial<ControlPolicy> = {}): ControlPolicy => ({
  version: "test:spend-1",
  spendCeilingsUsd: { agent: 10 },
  ...over,
});

describe("evaluateAction — spend ceilings", () => {
  it("allows when used + worst-case estimate stays under the ceiling", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority,
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0, spendSoFarUsd: { agent: 8 } },
      estimatedCostUsd: 1.5,
    });
    expect(r.decision).toBe("ALLOW");
    expect(r.wouldBlock).toBe(false);
  });

  it("DENYs when used + estimate exceeds the ceiling, with the exact reason format", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority,
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0, spendSoFarUsd: { agent: 9.5 } },
      estimatedCostUsd: 1,
    });
    expect(r.decision).toBe("DENY");
    expect(r.effectiveDecision).toBe("DENY");
    expect(r.wouldBlock).toBe(true);
    expect(r.reasons).toEqual([
      "Spend ceiling exceeded: $9.50 used + $1.00 estimated > $10.00 ceiling (agent)",
    ]);
  });

  it("allows exactly at the ceiling (only strictly-over denies)", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority,
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0, spendSoFarUsd: { agent: 9 } },
      estimatedCostUsd: 1,
    });
    expect(r.decision).toBe("ALLOW");
  });

  it("DENYs fail-closed when the ceiling is configured but spend state is missing", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority,
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0 },
      estimatedCostUsd: 0.01,
    });
    expect(r.decision).toBe("DENY");
    expect(r.reasons).toEqual([
      "Spend state unknown: ceiling configured for agent but spend so far is unknown",
    ]);
  });

  it("DENYs fail-closed when spend state is explicitly null", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority,
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0, spendSoFarUsd: { agent: null } },
      estimatedCostUsd: 0.01,
    });
    expect(r.decision).toBe("DENY");
    expect(r.reasons[0]).toContain("Spend state unknown");
  });

  it("evaluates every configured scope and names the failing one", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority,
      policy: policyWithCeiling({
        spendCeilingsUsd: { agent: 10, key: 2, user: 100 },
      }),
      cumulative: {
        actionCount: 1,
        amountMinor: 0,
        spendSoFarUsd: { agent: 1, key: 1.99, user: 5 },
      },
      estimatedCostUsd: 0.02,
    });
    expect(r.decision).toBe("DENY");
    expect(r.reasons).toEqual([
      "Spend ceiling exceeded: $1.99 used + $0.02 estimated > $2.00 ceiling (key)",
    ]);
  });

  it("scopes without a ceiling are not governed", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority,
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0, spendSoFarUsd: { agent: 1 } },
      estimatedCostUsd: 1,
    });
    expect(r.decision).toBe("ALLOW");
  });

  it("a ceiling DENY records decision DENY but stays ALLOW in shadow mode", () => {
    const r = evaluateAction({
      mode: "shadow",
      action: call(),
      authority,
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0, spendSoFarUsd: { agent: 9.5 } },
      estimatedCostUsd: 1,
    });
    expect(r.decision).toBe("DENY");
    expect(r.effectiveDecision).toBe("ALLOW");
    expect(r.wouldBlock).toBe(true);
    expect(r.enforced).toBe(false);
  });

  it("does not override an earlier authority DENY with a spend reason", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: call(),
      authority: { actions: ["database.read"] },
      policy: policyWithCeiling(),
      cumulative: { actionCount: 1, amountMinor: 0 },
      estimatedCostUsd: 0.01,
    });
    expect(r.decision).toBe("DENY");
    expect(r.reasons.some((reason) => reason.includes("Spend ceiling"))).toBe(false);
  });

  it("no ceilings configured leaves existing behavior untouched", () => {
    const r = evaluateAction({ mode: "enforce", action: call(), authority });
    expect(r.decision).toBe("ALLOW");
  });
});
