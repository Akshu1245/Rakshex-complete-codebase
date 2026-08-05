import type { AttenuationResult, AuthorityScope, SemanticAction } from "./types";

function matches(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
}

/**
 * Coverage check for ACTION lists, where an empty list means "deny everything"
 * (see actionAllowed: `scope.actions.some(...)` over an empty array is false).
 * An empty child therefore denies all actions and is maximally attenuated;
 * an empty parent denies all actions, so any non-empty child widens it.
 */
function actionsCovered(child: string[] | undefined, parent: string[] | undefined): boolean {
  if (!child?.length) return true;
  if (!parent?.length) return false;
  return child.every((value) => parent.some((pattern) => matches(pattern, value)));
}

/**
 * Coverage check for CONSTRAINT lists (resources, environments), where an
 * empty list means "no restriction" — the inverse of actions. See
 * actionAllowed: the resource/environment checks are skipped entirely when
 * `scope.resources`/`scope.environments` is empty.
 *
 * This asymmetry is the subtle part. If a child simply OMITS `resources`
 * while its parent is scoped to `customer:1827`, the child is not narrower —
 * it is unrestricted, and can act on any resource at all. Treating an absent
 * constraint as "attenuated" would let any holder of a scoped authority mint
 * a strictly more powerful child by leaving a field blank, which defeats the
 * entire delegation model. So: a restricted parent requires an explicit,
 * covered child constraint; an unrestricted parent accepts anything, because
 * any child constraint can only narrow it.
 */
function constraintCovered(child: string[] | undefined, parent: string[] | undefined): boolean {
  if (!parent?.length) return true;
  if (!child?.length) return false;
  return child.every((value) => parent.some((pattern) => matches(pattern, value)));
}

export function actionAllowed(
  scope: AuthorityScope,
  action: SemanticAction,
  now = new Date(),
): string[] {
  const reasons: string[] = [];
  if (!scope.actions.some((pattern) => matches(pattern, action.name))) {
    reasons.push(`Action ${action.name} is outside delegated authority`);
  }
  if (scope.resources?.length) {
    if (
      !action.resource ||
      !scope.resources.some((pattern) => matches(pattern, action.resource!))
    ) {
      reasons.push("Resource is outside delegated authority");
    }
  }
  if (scope.environments?.length) {
    if (!action.environment || !scope.environments.includes(action.environment)) {
      reasons.push("Environment is outside delegated authority");
    }
  }
  if (scope.validFrom && now < new Date(scope.validFrom))
    reasons.push("Authority is not active yet");
  if (scope.expiresAt && now >= new Date(scope.expiresAt)) reasons.push("Authority has expired");
  if (scope.maxAmountMinor != null && (action.amountMinor ?? 0) > scope.maxAmountMinor) {
    reasons.push(`Amount exceeds delegated limit of ${scope.maxAmountMinor} minor units`);
  }
  if (scope.currency && action.currency && scope.currency !== action.currency) {
    reasons.push(`Currency ${action.currency} is outside delegated authority`);
  }
  return reasons;
}

export function validateAttenuation(
  parent: AuthorityScope,
  child: AuthorityScope,
): AttenuationResult {
  const reasons: string[] = [];
  if (!actionsCovered(child.actions, parent.actions))
    reasons.push("Child actions exceed parent actions");
  if (!constraintCovered(child.resources, parent.resources))
    reasons.push(
      "Child resources exceed parent resources (an omitted resource scope is unrestricted, not attenuated)",
    );
  if (!constraintCovered(child.environments, parent.environments))
    reasons.push(
      "Child environments exceed parent environments (an omitted environment scope is unrestricted, not attenuated)",
    );
  if (
    parent.maxAmountMinor != null &&
    (child.maxAmountMinor == null || child.maxAmountMinor > parent.maxAmountMinor)
  ) {
    reasons.push("Child amount limit exceeds parent amount limit");
  }
  if (parent.currency && child.currency !== parent.currency)
    reasons.push("Child currency differs from parent currency");
  if (parent.maxCount != null && (child.maxCount == null || child.maxCount > parent.maxCount)) {
    reasons.push("Child action count exceeds parent action count");
  }
  if (parent.validFrom && (!child.validFrom || child.validFrom < parent.validFrom)) {
    reasons.push("Child validity begins before parent authority");
  }
  if (parent.expiresAt && (!child.expiresAt || child.expiresAt > parent.expiresAt)) {
    reasons.push("Child authority expires after parent authority");
  }
  if (
    parent.maxDelegationDepth != null &&
    (child.maxDelegationDepth == null || child.maxDelegationDepth >= parent.maxDelegationDepth)
  ) {
    reasons.push("Child delegation depth is not attenuated");
  }
  return { valid: reasons.length === 0, reasons };
}
