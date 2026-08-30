import { describe, expect, it } from "vitest";
import { planAdaptiveCapacity, type AdaptiveBudgetPolicy } from "./adaptiveBudgeting";

const policy: AdaptiveBudgetPolicy = {
  mode: "shareable",
  maxBorrowUsd: 25,
  approvalThresholdUsd: 20,
  emergencyMinPriority: "critical",
};

describe("adaptive AI budgeting", () => {
  it("uses personal capacity before shared capacity", () => {
    const plan = planAdaptiveCapacity(
      { requestId: "r1", amountUsd: 8, priority: "normal" },
      [
        { id: "shared", type: "team_shared", availableUsd: 20 },
        { id: "personal", type: "personal", availableUsd: 10 },
      ],
      policy,
    );

    expect(plan.allowed).toBe(true);
    expect(plan.slices).toEqual([
      {
        sourceId: "personal",
        sourceType: "personal",
        amountUsd: 8,
        ownerIdentityId: undefined,
        ownerProjectId: undefined,
      },
    ]);
  });

  it("borrows only the shareable amount above another member's protected reserve", () => {
    const plan = planAdaptiveCapacity(
      { requestId: "r2", amountUsd: 15, priority: "customer", allowBorrow: true },
      [
        { id: "personal", type: "personal", availableUsd: 5 },
        {
          id: "rahul",
          type: "member_shareable",
          availableUsd: 30,
          protectedUsd: 20,
          ownerIdentityId: 42,
        },
      ],
      policy,
    );

    expect(plan.allowed).toBe(true);
    expect(plan.borrowedUsd).toBe(10);
    expect(plan.shortfallUsd).toBe(0);
    expect(plan.slices[1]).toMatchObject({
      sourceId: "rahul",
      sourceType: "member_shareable",
      amountUsd: 10,
      ownerIdentityId: 42,
    });
  });

  it("never borrows member capacity in locked mode", () => {
    const plan = planAdaptiveCapacity(
      { requestId: "r3", amountUsd: 15, priority: "normal", allowBorrow: true },
      [
        { id: "personal", type: "personal", availableUsd: 5 },
        { id: "other-member", type: "member_shareable", availableUsd: 100 },
      ],
      { ...policy, mode: "locked" },
    );

    expect(plan.allowed).toBe(false);
    expect(plan.reservedUsd).toBe(5);
    expect(plan.shortfallUsd).toBe(10);
    expect(plan.slices.some((slice) => slice.sourceType === "member_shareable")).toBe(false);
  });

  it("requires approval when planned borrowing exceeds the configured threshold", () => {
    const plan = planAdaptiveCapacity(
      { requestId: "r4", amountUsd: 24, priority: "customer", allowBorrow: true },
      [{ id: "shareable", type: "member_shareable", availableUsd: 30 }],
      policy,
    );

    expect(plan.requiresApproval).toBe(true);
    expect(plan.allowed).toBe(false);
    expect(plan.borrowedUsd).toBe(24);
    expect(plan.shortfallUsd).toBe(0);
  });

  it("caps borrowing at maxBorrowUsd even when more shareable capacity exists", () => {
    const plan = planAdaptiveCapacity(
      { requestId: "r5", amountUsd: 40, priority: "customer", allowBorrow: true },
      [{ id: "shareable", type: "member_shareable", availableUsd: 100 }],
      { ...policy, approvalThresholdUsd: 100 },
    );

    expect(plan.borrowedUsd).toBe(25);
    expect(plan.reservedUsd).toBe(25);
    expect(plan.shortfallUsd).toBe(15);
    expect(plan.allowed).toBe(false);
  });

  it("only uses emergency reserve for sufficiently important requests", () => {
    const normal = planAdaptiveCapacity(
      { requestId: "r6", amountUsd: 10, priority: "normal", allowEmergency: true },
      [{ id: "emergency", type: "emergency_reserve", availableUsd: 50 }],
      policy,
    );
    const critical = planAdaptiveCapacity(
      { requestId: "r7", amountUsd: 10, priority: "critical", allowEmergency: true },
      [{ id: "emergency", type: "emergency_reserve", availableUsd: 50 }],
      policy,
    );

    expect(normal.allowed).toBe(false);
    expect(critical.allowed).toBe(true);
    expect(critical.slices[0]?.sourceType).toBe("emergency_reserve");
  });

  it("fails closed with the exact shortfall when approved capacity is insufficient", () => {
    const plan = planAdaptiveCapacity(
      { requestId: "r8", amountUsd: 12, priority: "normal" },
      [{ id: "personal", type: "personal", availableUsd: 4.5 }],
      policy,
    );

    expect(plan.allowed).toBe(false);
    expect(plan.reservedUsd).toBe(4.5);
    expect(plan.shortfallUsd).toBe(7.5);
    expect(plan.reasons.join(" ")).toContain("shortfall 7.50 USD");
  });
});
