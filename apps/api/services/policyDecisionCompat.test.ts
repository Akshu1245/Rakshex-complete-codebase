/**
 * Differential guard over the two live policy engines.
 *
 * These tests do not assert that the engines agree — they don't, and pretending
 * otherwise would hide the problem. They assert that the *divergence is known
 * and handled*, so that the fail-open hazard described in
 * policyDecisionCompat.ts cannot silently reappear.
 *
 * The first block is the important one: it pins both engines' action
 * vocabularies. If someone adds an action to either engine, or renames one,
 * these fail loudly rather than letting an unmapped string reach an
 * enforcement check and fall through to "allowed".
 */
import { describe, expect, it } from "vitest";
import {
  isAdvisory,
  isBlocking,
  isRedacting,
  normalizeAction,
  type AnyPolicyAction,
} from "./policyDecisionCompat";

// Mirrored from apps/api/engines/policyEngine.ts (PolicyAction).
const APP_ENGINE_ACTIONS = ["allow", "block", "redact", "alert_only", "require_approval"] as const;

// Mirrored from @rakshex/policy-engine (DecisionAction).
const PACKAGE_ENGINE_ACTIONS = ["allow", "deny", "require_approval", "redact", "warn"] as const;

describe("policy engine vocabularies", () => {
  it("every app-engine action is mapped", () => {
    for (const action of APP_ENGINE_ACTIONS) {
      // An unmapped action would fall through to the "deny" default, which is
      // safe but silent — so assert the mapping is explicit, not incidental.
      expect(Object.keys(CANONICAL_KEYS)).toContain(action);
    }
  });

  it("every package-engine action is mapped", () => {
    for (const action of PACKAGE_ENGINE_ACTIONS) {
      expect(Object.keys(CANONICAL_KEYS)).toContain(action);
    }
  });

  it("documents that the two vocabularies genuinely differ", () => {
    // If this ever becomes false, the engines have converged and this whole
    // compat layer (and CLAUDE.md §5 item 0) can be revisited.
    const appOnly = APP_ENGINE_ACTIONS.filter(
      (a) => !(PACKAGE_ENGINE_ACTIONS as readonly string[]).includes(a),
    );
    const packageOnly = PACKAGE_ENGINE_ACTIONS.filter(
      (a) => !(APP_ENGINE_ACTIONS as readonly string[]).includes(a),
    );
    expect(appOnly).toEqual(["block", "alert_only"]);
    expect(packageOnly).toEqual(["deny", "warn"]);
  });

  it("maps the differing spellings onto the same meaning", () => {
    expect(normalizeAction("block")).toBe(normalizeAction("deny"));
    expect(normalizeAction("alert_only")).toBe(normalizeAction("warn"));
  });
});

describe("isBlocking — the fail-open guard", () => {
  it("treats BOTH deny spellings as blocking", () => {
    // This is the bug this file exists to prevent: gateway/enforcement.ts
    // gates on `action === "deny"`, so an app-engine "block" routed through
    // that check would fall through and ALLOW the request.
    expect(isBlocking("deny")).toBe(true);
    expect(isBlocking("block")).toBe(true);
  });

  it("treats require_approval as blocking", () => {
    // It must not execute until a human resolves it. Treating it as
    // non-blocking would let exactly the actions that needed review through
    // unreviewed.
    expect(isBlocking("require_approval")).toBe(true);
  });

  it("does not block allow, redact, or either advisory spelling", () => {
    for (const action of ["allow", "redact", "warn", "alert_only"]) {
      expect(isBlocking(action)).toBe(false);
    }
  });

  it("fails CLOSED on an unrecognised action", () => {
    // Drift between the engines must not read as permission.
    expect(isBlocking("some_future_action")).toBe(true);
    expect(normalizeAction("some_future_action")).toBe("deny");
    expect(isBlocking("")).toBe(true);
  });

  it("blocks every action from both engines that is not allow/redact/advisory", () => {
    const permitted = new Set(["allow", "redact", "warn", "alert_only"]);
    for (const action of [...APP_ENGINE_ACTIONS, ...PACKAGE_ENGINE_ACTIONS]) {
      expect(isBlocking(action)).toBe(!permitted.has(action));
    }
  });
});

describe("isRedacting / isAdvisory", () => {
  it("recognises redact from either engine", () => {
    expect(isRedacting("redact")).toBe(true);
    expect(isRedacting("allow")).toBe(false);
  });

  it("recognises both advisory spellings", () => {
    expect(isAdvisory("warn")).toBe(true);
    expect(isAdvisory("alert_only")).toBe(true);
  });

  it("does not treat advisory as allow", () => {
    // A warn still needs to raise an alert; collapsing it into "allow" would
    // silently drop that signal.
    expect(normalizeAction("alert_only")).not.toBe("allow");
  });
});

/** Keys of the internal map, re-derived so the tests above can assert on it. */
const CANONICAL_KEYS: Record<AnyPolicyAction, true> = {
  allow: true,
  block: true,
  deny: true,
  redact: true,
  alert_only: true,
  warn: true,
  require_approval: true,
};
