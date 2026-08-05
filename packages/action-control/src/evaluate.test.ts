/**
 * Decision-engine tests.
 *
 * evaluateAction() is the single function every enforced agent action passes
 * through, so each decision branch gets explicit coverage here, along with the
 * shadow-vs-enforce split (shadow must record the true decision while always
 * returning an effective ALLOW — getting that backwards would either block
 * traffic during a supposedly safe rollout, or silently fail open in
 * production).
 */
import { describe, expect, it } from "vitest";
import { evaluateAction, normalizeSemanticAction } from "./index";
import type { AuthorityScope, ControlPolicy } from "./types";

const refund = (over: Partial<Parameters<typeof normalizeSemanticAction>[0]> = {}) =>
  normalizeSemanticAction({
    provider: "stripe",
    operation: "refunds.create",
    resource: "customer:1827",
    environment: "production",
    amountMinor: 100_000,
    currency: "INR",
    ...over,
  });

const authority: AuthorityScope = {
  actions: ["financial.*", "database.read"],
  resources: ["customer:*"],
  environments: ["production"],
  maxAmountMinor: 500_000,
  currency: "INR",
};

describe("evaluateAction — baseline", () => {
  it("allows an in-scope action and says so", () => {
    const r = evaluateAction({ mode: "enforce", action: refund(), authority });
    expect(r.decision).toBe("ALLOW");
    expect(r.effectiveDecision).toBe("ALLOW");
    expect(r.wouldBlock).toBe(false);
    expect(r.reasons).toEqual(["Action is within delegated authority and policy"]);
  });

  it("reports the policy version in use", () => {
    expect(evaluateAction({ mode: "enforce", action: refund(), authority }).policyVersion).toBe(
      "builtin:0.1",
    );
    expect(
      evaluateAction({
        mode: "enforce",
        action: refund(),
        authority,
        policy: { version: "org:v7" },
      }).policyVersion,
    ).toBe("org:v7");
  });
});

describe("evaluateAction — hard stops", () => {
  it("FREEZEs regardless of authority", () => {
    const r = evaluateAction({ mode: "enforce", action: refund(), authority, frozen: true });
    expect(r.decision).toBe("FREEZE");
    expect(r.effectiveDecision).toBe("DENY");
    expect(r.reasons).toContain("Agent or workspace is frozen");
  });

  it("freeze takes precedence over an otherwise-valid authority", () => {
    const r = evaluateAction({ mode: "enforce", action: refund(), authority, frozen: true });
    expect(r.decision).toBe("FREEZE");
  });

  it("DENYs when no authority is supplied at all", () => {
    const r = evaluateAction({ mode: "enforce", action: refund(), authority: null });
    expect(r.decision).toBe("DENY");
    expect(r.reasons).toContain("No active delegated authority was supplied");
  });

  it("DENYs an action outside the delegated scope", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: refund({ amountMinor: 900_000 }),
      authority,
    });
    expect(r.decision).toBe("DENY");
  });
});

describe("evaluateAction — unknown actions", () => {
  const unknownWrite = normalizeSemanticAction({ provider: "acme", operation: "doTheThing" });

  it("defaults an unknown non-read action to DENY", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: unknownWrite,
      authority: { actions: ["*"] },
    });
    expect(r.decision).toBe("DENY");
    expect(r.reasons.some((x) => x.includes("Unknown write"))).toBe(true);
  });

  it("honours a policy that downgrades unknown writes to approval", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: unknownWrite,
      authority: { actions: ["*"] },
      policy: { version: "v1", unknownWriteDecision: "APPROVAL_REQUIRED" },
    });
    expect(r.decision).toBe("APPROVAL_REQUIRED");
    expect(r.effectiveDecision).toBe("PENDING_APPROVAL");
  });
});

describe("evaluateAction — organization policy", () => {
  it("DENYs an action matched by a policy denylist", () => {
    const policy: ControlPolicy = { version: "v1", denyActions: ["financial.*"] };
    const r = evaluateAction({ mode: "enforce", action: refund(), authority, policy });
    expect(r.decision).toBe("DENY");
    expect(r.reasons).toContain("Organization policy denies this action");
  });

  it("requires approval for an action on the approval list", () => {
    const policy: ControlPolicy = { version: "v1", approvalActions: ["financial.refund"] };
    const r = evaluateAction({ mode: "enforce", action: refund(), authority, policy });
    expect(r.decision).toBe("APPROVAL_REQUIRED");
    expect(r.effectiveDecision).toBe("PENDING_APPROVAL");
  });

  it("denylist wins over approval list", () => {
    const policy: ControlPolicy = {
      version: "v1",
      denyActions: ["financial.refund"],
      approvalActions: ["financial.refund"],
    };
    expect(evaluateAction({ mode: "enforce", action: refund(), authority, policy }).decision).toBe(
      "DENY",
    );
  });

  it("requires approval above the amount threshold", () => {
    const policy: ControlPolicy = { version: "v1", approvalAboveMinor: 50_000 };
    const r = evaluateAction({ mode: "enforce", action: refund(), authority, policy });
    expect(r.decision).toBe("APPROVAL_REQUIRED");
    expect(r.reasons).toContain("Action amount exceeds the approval threshold");
  });

  it("does not require approval at exactly the threshold", () => {
    const policy: ControlPolicy = { version: "v1", approvalAboveMinor: 100_000 };
    expect(evaluateAction({ mode: "enforce", action: refund(), authority, policy }).decision).toBe(
      "ALLOW",
    );
  });
});

describe("evaluateAction — cumulative controls", () => {
  it("LIMITs once the delegated action count is spent", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: refund(),
      authority: { ...authority, maxCount: 3 },
      cumulative: { actionCount: 3, amountMinor: 0 },
    });
    expect(r.decision).toBe("LIMIT");
    expect(r.effectiveDecision).toBe("DENY");
    expect(r.reasons).toContain("Delegated action-count limit has been reached");
  });

  it("still allows the final action within the count", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: refund(),
      authority: { ...authority, maxCount: 3 },
      cumulative: { actionCount: 2, amountMinor: 0 },
    });
    expect(r.decision).toBe("ALLOW");
  });

  it("PAUSEs when the daily amount cap would be breached by this action", () => {
    const policy: ControlPolicy = { version: "v1", dailyAmountLimitMinor: 150_000 };
    const r = evaluateAction({
      mode: "enforce",
      action: refund({ amountMinor: 100_000 }),
      authority,
      policy,
      cumulative: { actionCount: 1, amountMinor: 100_000 },
    });
    expect(r.decision).toBe("PAUSE");
    expect(r.reasons).toContain("Cumulative daily amount limit would be exceeded");
  });

  it("allows an action that lands exactly on the daily cap", () => {
    const policy: ControlPolicy = { version: "v1", dailyAmountLimitMinor: 200_000 };
    const r = evaluateAction({
      mode: "enforce",
      action: refund({ amountMinor: 100_000 }),
      authority,
      policy,
      cumulative: { actionCount: 1, amountMinor: 100_000 },
    });
    expect(r.decision).toBe("ALLOW");
  });
});

describe("evaluateAction — dangerous sequences", () => {
  const policy: ControlPolicy = {
    version: "v1",
    dangerousSequences: [["database.read", "financial.refund"]],
  };

  it("requires approval when the action completes a flagged sequence", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: refund(),
      authority,
      policy,
      cumulative: { actionCount: 1, amountMinor: 0, recentActions: ["database.read"] },
    });
    expect(r.decision).toBe("APPROVAL_REQUIRED");
    expect(r.reasons).toContain("Action completes a configured high-risk sequence");
  });

  it("ignores the same actions in a different order", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: normalizeSemanticAction({
        provider: "postgres",
        operation: "query",
        parameters: { sql: "SELECT 1" },
        resource: "customer:1827",
        environment: "production",
      }),
      authority,
      policy,
      cumulative: { actionCount: 1, amountMinor: 0, recentActions: ["financial.refund"] },
    });
    expect(r.decision).toBe("ALLOW");
  });

  it("only matches the sequence at the tail of history", () => {
    const r = evaluateAction({
      mode: "enforce",
      action: refund(),
      authority,
      policy,
      cumulative: {
        actionCount: 2,
        amountMinor: 0,
        recentActions: ["database.read", "financial.payout"],
      },
    });
    expect(r.decision).toBe("ALLOW");
  });
});

describe("evaluateAction — shadow vs enforce", () => {
  const overLimit = () => refund({ amountMinor: 900_000 });

  it("shadow records the real decision but never blocks", () => {
    const r = evaluateAction({ mode: "shadow", action: overLimit(), authority });
    expect(r.decision).toBe("DENY");
    expect(r.effectiveDecision).toBe("ALLOW");
    expect(r.wouldBlock).toBe(true);
    expect(r.enforced).toBe(false);
  });

  it("shadow does not mask an approval requirement either", () => {
    const r = evaluateAction({
      mode: "shadow",
      action: refund(),
      authority,
      policy: { version: "v1", approvalActions: ["financial.*"] },
    });
    expect(r.decision).toBe("APPROVAL_REQUIRED");
    expect(r.effectiveDecision).toBe("ALLOW");
  });

  it("shadow does not even block a freeze", () => {
    const r = evaluateAction({ mode: "shadow", action: refund(), authority, frozen: true });
    expect(r.decision).toBe("FREEZE");
    expect(r.effectiveDecision).toBe("ALLOW");
  });

  it("enforce blocks the identical action", () => {
    const r = evaluateAction({ mode: "enforce", action: overLimit(), authority });
    expect(r.decision).toBe("DENY");
    expect(r.effectiveDecision).toBe("DENY");
    expect(r.enforced).toBe(true);
  });

  it("shadow and enforce always agree on the underlying decision", () => {
    const cases = [
      { action: refund(), authority, frozen: false },
      { action: overLimit(), authority, frozen: false },
      { action: refund(), authority: null, frozen: false },
      { action: refund(), authority, frozen: true },
    ];
    for (const c of cases) {
      const s = evaluateAction({ mode: "shadow", ...c });
      const e = evaluateAction({ mode: "enforce", ...c });
      expect(s.decision).toBe(e.decision);
      expect(s.wouldBlock).toBe(e.wouldBlock);
    }
  });
});
