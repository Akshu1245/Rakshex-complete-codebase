/**
 * Compatibility layer between the two policy engines that are live in this
 * codebase. Read this before touching any policy code.
 *
 * There are currently TWO functions named `evaluatePolicy`, with different
 * data models and — critically — different action vocabularies:
 *
 *   apps/api/engines/policyEngine.ts   allow | block | redact | alert_only | require_approval
 *   @rakshex/policy-engine             allow | deny  | redact | warn       | require_approval
 *
 * "block" and "deny" mean the same thing. So do "alert_only" and "warn".
 * Neither engine knows about the other's spelling.
 *
 * Why this file exists: `services/gateway/enforcement.ts` gates on
 * `decision.action === "deny"`. That is correct for the package engine it
 * calls today. But if an app-engine decision is ever routed through the same
 * check, `"block"` will not match `"deny"`, the condition falls through, and
 * the request is **allowed**. A vocabulary mismatch that fails open is the
 * worst possible failure mode for an enforcement point, and nothing in the
 * type system catches it — both types are just string unions that happen to
 * share the name `PolicyDecision`.
 *
 * So: never compare a policy action to a string literal directly. Use
 * `isBlocking()` / `normalizeAction()` here, which accept either vocabulary.
 *
 * This is a bridge, not a destination. The real fix is to converge on one
 * engine (see CLAUDE.md §5 item 0). Deleting this file is safe only once
 * that migration is done and one vocabulary is gone.
 */

/** Every action either engine can emit. */
export type AnyPolicyAction =
  "allow" | "block" | "deny" | "redact" | "alert_only" | "warn" | "require_approval";

/** The canonical vocabulary, chosen to match @rakshex/policy-engine. */
export type CanonicalPolicyAction = "allow" | "deny" | "redact" | "warn" | "require_approval";

const CANONICAL: Record<AnyPolicyAction, CanonicalPolicyAction> = {
  allow: "allow",
  block: "deny",
  deny: "deny",
  redact: "redact",
  alert_only: "warn",
  warn: "warn",
  require_approval: "require_approval",
};

/**
 * Map either engine's action onto the canonical vocabulary.
 *
 * Unknown values map to "deny" rather than "allow". An action string we do
 * not recognise means the engines have drifted again, and at an enforcement
 * point the safe response to "I don't understand this decision" is to refuse,
 * not to permit.
 */
export function normalizeAction(action: string): CanonicalPolicyAction {
  return CANONICAL[action as AnyPolicyAction] ?? "deny";
}

/**
 * True when the action should stop the request from proceeding as-is.
 *
 * `require_approval` counts as blocking: the action must not execute until a
 * human resolves it, so treating it as non-blocking would let the very
 * actions that needed review through unreviewed.
 */
export function isBlocking(action: string): boolean {
  const canonical = normalizeAction(action);
  return canonical === "deny" || canonical === "require_approval";
}

/** True when the action permits execution but wants the payload altered. */
export function isRedacting(action: string): boolean {
  return normalizeAction(action) === "redact";
}

/**
 * True when the action is advisory — record it, but let the request through.
 * Note this is NOT the same as "allow": a warn should still raise an alert.
 */
export function isAdvisory(action: string): boolean {
  return normalizeAction(action) === "warn";
}
