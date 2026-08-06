/**
 * Delegated-authority tests.
 *
 * The product's headline claim is that a child authority can never exceed its
 * parent. That claim is only as good as validateAttenuation(), so the
 * escalation cases below are the ones that matter most — several of them are
 * regression tests for a real bypass found on 2026-08-05, where a child that
 * simply OMITTED `resources`/`environments` passed validation and then had
 * unrestricted access at evaluation time.
 */
import { describe, expect, it } from "vitest";
import { actionAllowed, normalizeSemanticAction, validateAttenuation } from "./index";
import type { AuthorityScope } from "./types";

const action = (over: Partial<Parameters<typeof normalizeSemanticAction>[0]> = {}) =>
  normalizeSemanticAction({
    provider: "stripe",
    operation: "refunds.create",
    resource: "customer:1827",
    environment: "production",
    amountMinor: 100_000,
    currency: "INR",
    ...over,
  });

describe("actionAllowed", () => {
  const scope: AuthorityScope = {
    actions: ["financial.refund"],
    resources: ["customer:*"],
    environments: ["production"],
    maxAmountMinor: 500_000,
    currency: "INR",
  };

  it("allows an action fully inside scope", () => {
    expect(actionAllowed(scope, action())).toEqual([]);
  });

  it("rejects an action outside the delegated action list", () => {
    const reasons = actionAllowed(scope, action({ provider: "github", operation: "pulls.merge" }));
    expect(reasons.some((r) => r.includes("outside delegated authority"))).toBe(true);
  });

  it("rejects a resource outside scope", () => {
    const reasons = actionAllowed(scope, action({ resource: "invoice:99" }));
    expect(reasons).toContain("Resource is outside delegated authority");
  });

  it("rejects an action with no resource when the scope is resource-restricted", () => {
    const reasons = actionAllowed(scope, action({ resource: undefined }));
    expect(reasons).toContain("Resource is outside delegated authority");
  });

  it("rejects an environment outside scope", () => {
    const reasons = actionAllowed(scope, action({ environment: "staging" }));
    expect(reasons).toContain("Environment is outside delegated authority");
  });

  it("rejects an amount over the delegated limit", () => {
    const reasons = actionAllowed(scope, action({ amountMinor: 500_001 }));
    expect(reasons.some((r) => r.includes("Amount exceeds delegated limit"))).toBe(true);
  });

  it("allows an amount exactly at the delegated limit", () => {
    expect(actionAllowed(scope, action({ amountMinor: 500_000 }))).toEqual([]);
  });

  it("rejects a currency mismatch", () => {
    const reasons = actionAllowed(scope, action({ currency: "USD" }));
    expect(reasons.some((r) => r.includes("Currency USD"))).toBe(true);
  });

  it("rejects an authority that has expired", () => {
    const reasons = actionAllowed(
      { ...scope, expiresAt: "2026-01-01T00:00:00.000Z" },
      action(),
      new Date("2026-06-01T00:00:00.000Z"),
    );
    expect(reasons).toContain("Authority has expired");
  });

  it("treats the expiry instant itself as expired", () => {
    const at = "2026-06-01T00:00:00.000Z";
    expect(actionAllowed({ ...scope, expiresAt: at }, action(), new Date(at))).toContain(
      "Authority has expired",
    );
  });

  it("rejects an authority that is not yet active", () => {
    const reasons = actionAllowed(
      { ...scope, validFrom: "2026-12-01T00:00:00.000Z" },
      action(),
      new Date("2026-06-01T00:00:00.000Z"),
    );
    expect(reasons).toContain("Authority is not active yet");
  });

  it("applies no resource restriction when the scope omits resources", () => {
    const open: AuthorityScope = { actions: ["financial.refund"] };
    expect(actionAllowed(open, action({ resource: "anything:at:all" }))).toEqual([]);
  });
});

describe("validateAttenuation", () => {
  const parent: AuthorityScope = {
    actions: ["financial.*", "database.read"],
    resources: ["customer:*"],
    environments: ["production", "staging"],
    maxAmountMinor: 500_000,
    currency: "INR",
    maxCount: 10,
    validFrom: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-08-31T00:00:00.000Z",
    maxDelegationDepth: 2,
  };

  const validChild: AuthorityScope = {
    actions: ["financial.refund"],
    resources: ["customer:1827"],
    environments: ["production"],
    maxAmountMinor: 100_000,
    currency: "INR",
    maxCount: 1,
    validFrom: "2026-02-01T00:00:00.000Z",
    expiresAt: "2026-08-02T00:00:00.000Z",
    maxDelegationDepth: 1,
  };

  it("accepts a strictly narrower child", () => {
    expect(validateAttenuation(parent, validChild)).toEqual({ valid: true, reasons: [] });
  });

  it("rejects an action outside the parent's actions", () => {
    const res = validateAttenuation(parent, { ...validChild, actions: ["code.merge"] });
    expect(res.valid).toBe(false);
    expect(res.reasons).toContain("Child actions exceed parent actions");
  });

  it("rejects a resource outside the parent's resources", () => {
    const res = validateAttenuation(parent, { ...validChild, resources: ["invoice:*"] });
    expect(res.valid).toBe(false);
  });

  it("rejects a higher amount limit", () => {
    const res = validateAttenuation(parent, { ...validChild, maxAmountMinor: 500_001 });
    expect(res.reasons).toContain("Child amount limit exceeds parent amount limit");
  });

  it("rejects a higher action count", () => {
    const res = validateAttenuation(parent, { ...validChild, maxCount: 11 });
    expect(res.reasons).toContain("Child action count exceeds parent action count");
  });

  it("rejects an expiry later than the parent's", () => {
    const res = validateAttenuation(parent, {
      ...validChild,
      expiresAt: "2026-09-30T00:00:00.000Z",
    });
    expect(res.reasons).toContain("Child authority expires after parent authority");
  });

  it("rejects a validity window starting before the parent's", () => {
    const res = validateAttenuation(parent, {
      ...validChild,
      validFrom: "2025-01-01T00:00:00.000Z",
    });
    expect(res.reasons).toContain("Child validity begins before parent authority");
  });

  it("rejects a currency change", () => {
    const res = validateAttenuation(parent, { ...validChild, currency: "USD" });
    expect(res.reasons).toContain("Child currency differs from parent currency");
  });

  it("rejects a delegation depth that is not attenuated", () => {
    const res = validateAttenuation(parent, { ...validChild, maxDelegationDepth: 2 });
    expect(res.reasons).toContain("Child delegation depth is not attenuated");
  });

  // ── Escalation-by-omission regression tests ───────────────────────────────
  // Each of these passed validation before 2026-08-05 and granted the child
  // BROADER authority than its parent.

  it("rejects a child that omits resources under a resource-scoped parent", () => {
    const res = validateAttenuation(parent, { ...validChild, resources: undefined });
    expect(res.valid).toBe(false);
    expect(res.reasons.some((r) => r.includes("Child resources exceed parent resources"))).toBe(
      true,
    );
  });

  it("rejects a child that omits environments under an environment-scoped parent", () => {
    const res = validateAttenuation(parent, { ...validChild, environments: undefined });
    expect(res.valid).toBe(false);
    expect(
      res.reasons.some((r) => r.includes("Child environments exceed parent environments")),
    ).toBe(true);
  });

  it("rejects a child that omits BOTH constraints (the original bypass)", () => {
    const res = validateAttenuation(
      { actions: ["financial.*"], resources: ["customer:1827"], environments: ["staging"] },
      { actions: ["financial.refund"] },
    );
    expect(res.valid).toBe(false);
  });

  it("proves the omitted-constraint child really would have been broader", () => {
    const scopedParent: AuthorityScope = {
      actions: ["financial.*"],
      resources: ["customer:1827"],
      environments: ["staging"],
    };
    const omittingChild: AuthorityScope = { actions: ["financial.refund"] };
    const elsewhere = action({ resource: "customer:9999", environment: "production" });

    // The parent correctly refuses this action...
    expect(actionAllowed(scopedParent, elsewhere).length).toBeGreaterThan(0);
    // ...and the child would have permitted it, which is why the validator
    // above must reject the child at issuance time.
    expect(actionAllowed(omittingChild, elsewhere)).toEqual([]);
    expect(validateAttenuation(scopedParent, omittingChild).valid).toBe(false);
  });

  // ── Legitimate-narrowing cases the old logic wrongly rejected ─────────────

  it("accepts a child that ADDS a resource constraint under an unrestricted parent", () => {
    const openParent: AuthorityScope = { actions: ["financial.*"] };
    const res = validateAttenuation(openParent, {
      actions: ["financial.refund"],
      resources: ["customer:1827"],
    });
    expect(res.valid).toBe(true);
  });

  it("accepts a child that ADDS an environment constraint under an unrestricted parent", () => {
    const openParent: AuthorityScope = { actions: ["financial.*"] };
    const res = validateAttenuation(openParent, {
      actions: ["financial.refund"],
      environments: ["staging"],
    });
    expect(res.valid).toBe(true);
  });

  it("accepts a child that denies everything", () => {
    expect(validateAttenuation(parent, { ...validChild, actions: [] }).valid).toBe(true);
  });

  it("rejects any non-empty child under a deny-all parent", () => {
    const denyAll: AuthorityScope = { actions: [] };
    expect(validateAttenuation(denyAll, { actions: ["financial.refund"] }).valid).toBe(false);
  });

  it("is not fooled by a wildcard child under a specific parent", () => {
    const res = validateAttenuation(parent, { ...validChild, actions: ["*"] });
    expect(res.valid).toBe(false);
  });

  it("is not fooled by a broader wildcard prefix", () => {
    // parent allows "financial.*"; child asking for "*" or "fin*" is broader.
    expect(validateAttenuation(parent, { ...validChild, resources: ["*"] }).valid).toBe(false);
  });
});
