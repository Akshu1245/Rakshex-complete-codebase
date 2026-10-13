/**
 * Proposed action-path risk classification, not yet wired to production routing.
 *
 * Default-deny promotion: no semantic action is eligible for asynchronous
 * Class B authorization just because its name or effect says "read".
 * Class B requires a separate signed, versioned resource-level eligibility
 * proof, revocation strategy and durable receipt-intent implementation.
 *
 * Keep this table synchronized with semanticActions.ts (see coverage tests).
 */
import type { ActionDomain, ActionEffect, SemanticAction } from "./types";

export type ActionClass = "A" | "B";
export type FailMode = "DENY_UNLESS_AUTHORITATIVE_AND_RECEIPTED" | "ALLOW_ONLY_WITH_DURABLE_INTENT";
export type BReadiness = "not-eligible" | "candidate-requires-review";

export interface ActionClassRow {
  readonly name: string;
  readonly domain: ActionDomain;
  readonly effect: ActionEffect;
  readonly actionClass: ActionClass;
  readonly revocationSources: readonly string[];
  readonly failMode: FailMode;
  readonly bReadiness: BReadiness;
  readonly rationale: string;
}

const A = "DENY_UNLESS_AUTHORITATIVE_AND_RECEIPTED" as const;
const COMMON = ["workspace/agent status", "delegated authority", "versioned policy"] as const;
const FINANCIAL = [...COMMON, "provider credential status", "financial limits"] as const;
const CODE = [...COMMON, "repository permissions", "deployment/branch policy"] as const;
const DATABASE = [...COMMON, "database/tenant access permissions"] as const;

/** Explicit, deliberately conservative policy inventory. No production router imports it yet. */
export const ACTION_CLASS_MATRIX: readonly ActionClassRow[] = [
  {
    name: "financial.refund",
    domain: "financial",
    effect: "write",
    actionClass: "A",
    revocationSources: FINANCIAL,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Refund moves money",
  },
  {
    name: "financial.payment.create",
    domain: "financial",
    effect: "write",
    actionClass: "A",
    revocationSources: FINANCIAL,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Payment can transfer money",
  },
  {
    name: "financial.subscription.cancel",
    domain: "financial",
    effect: "destructive",
    actionClass: "A",
    revocationSources: FINANCIAL,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Cancellation has customer impact",
  },
  {
    name: "code.pr.create",
    domain: "code",
    effect: "write",
    actionClass: "A",
    revocationSources: CODE,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "PR creation mutates repository state",
  },
  {
    name: "code.merge",
    domain: "code",
    effect: "destructive",
    actionClass: "A",
    revocationSources: CODE,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Merge changes executable code",
  },
  {
    name: "code.branch.delete",
    domain: "code",
    effect: "destructive",
    actionClass: "A",
    revocationSources: CODE,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Branch deletion destroys references",
  },
  {
    name: "code.deploy",
    domain: "code",
    effect: "destructive",
    actionClass: "A",
    revocationSources: CODE,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Deploy affects live systems",
  },
  {
    name: "database.read",
    domain: "database",
    effect: "read",
    actionClass: "A",
    revocationSources: DATABASE,
    failMode: A,
    bReadiness: "candidate-requires-review",
    rationale:
      "Read queries may expose PII/secrets or invoke side-effecting SQL; cannot safely infer low risk from SQL regex",
  },
  {
    name: "database.write",
    domain: "database",
    effect: "write",
    actionClass: "A",
    revocationSources: DATABASE,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Mutation requires live authorization",
  },
  {
    name: "database.delete",
    domain: "database",
    effect: "destructive",
    actionClass: "A",
    revocationSources: DATABASE,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Deletion is destructive",
  },
  {
    name: "database.schema.change",
    domain: "database",
    effect: "destructive",
    actionClass: "A",
    revocationSources: DATABASE,
    failMode: A,
    bReadiness: "not-eligible",
    rationale: "Schema changes are high impact",
  },
];

export const UNKNOWN_ACTION_CLASS: ActionClassRow = {
  name: "semantic.unknown",
  domain: "unknown",
  effect: "unknown",
  actionClass: "A",
  revocationSources: COMMON,
  failMode: A,
  bReadiness: "not-eligible",
  rationale: "Unclassified, conflicting or spoofed action is high risk by default",
};

const byName = new Map(ACTION_CLASS_MATRIX.map((row) => [row.name, row]));

/**
 * Non-authoritative classification metadata for rollout planning.
 * Even a future B row MUST NOT make an ALLOW decision by itself.
 * Only a separate, verified signed bundle and durable receipt-intent path can do that.
 */
export function classifySemanticAction(
  action: Pick<SemanticAction, "name" | "known" | "domain" | "effect">,
): ActionClassRow {
  const row = byName.get(action.name);
  return row && action.known && row.domain === action.domain && row.effect === action.effect
    ? row
    : UNKNOWN_ACTION_CLASS;
}
