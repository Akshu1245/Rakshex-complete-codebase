/**
 * Policy Engine — Evaluates AI telemetry events against workspace rules.
 *
 * UNIFICATION NOTE (see CLAUDE.md §5 item 0 and
 * docs/POLICY_ENGINE_UNIFICATION.md): this file used to be a second,
 * independent policy engine, with its own data model, action vocabulary,
 * and hardcoded first-match-wins semantics, running alongside
 * `@rakshex/policy-engine`'s compiled-document engine on a different
 * request path. A differential test proved the two engines disagreed on
 * 3 of 10 real-world policy intents. That is now fixed by construction,
 * not by convention: this file is a thin, vocabulary-preserving adapter
 * over `@rakshex/policy-engine`. There is exactly one place decisions are
 * actually made — `packages/policy-engine/src/evaluate.ts` — and this
 * module's only job is to keep every existing caller's types and return
 * shape unchanged so nothing downstream (`middleware/policyEnforcement.ts`,
 * `services/policyCache.ts`, `api/policies.ts`, and anything else that
 * imports `evaluatePolicy`/`PolicyRule`/`AIEventContext` from here) has to
 * change.
 *
 * Do not re-implement condition evaluation in this file again. If a new
 * condition operator or field is needed, add it to
 * `packages/policy-engine/src/evaluate.ts`'s `getRuleFieldValue`, not here.
 *
 * Performance target: < 50ms for 1000 rules (inherited from the package
 * engine's generic-rules path, which this delegates to unchanged).
 */
import { logger } from "../_core/logger";
import {
  evaluatePolicy as evaluatePackagePolicy,
  type DecisionAction,
  type EvaluationContext,
  type GenericRule,
} from "@rakshex/policy-engine";

export type PolicyAction = "allow" | "block" | "redact" | "alert_only" | "require_approval";

export type ConditionOp =
  "eq" | "in" | "not_in" | "gt" | "lt" | "gte" | "lte" | "regex" | "keyword" | "between";

export interface Condition {
  field: string;
  op: ConditionOp;
  value: string | string[] | number | [number, number];
}

export interface PolicyRule {
  ruleId: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: { operator: "AND" | "OR"; rules: Condition[] };
  action: PolicyAction;
}

export interface AIEventContext {
  model: string;
  provider: string;
  costUsd: number;
  inputTokens: number;
  prompt: string;
  threatLevel: "none" | "low" | "medium" | "high" | "critical";
  agentId: string;
  userId?: string;
  toolCalls?: Array<{ name: string }>;
  timestamp: Date;
}

export interface PolicyDecision {
  action: PolicyAction;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  reason: string;
}

// --- Vocabulary mapping between this file's historical action names and
// the package engine's canonical ones. "block"/"deny" and "alert_only"/
// "warn" mean the same thing; nothing else needed to change once this
// mapping is applied consistently at the boundary. See
// services/policyDecisionCompat.ts for the sibling mapping used at
// enforcement points that consume either engine's raw output — that file
// still exists for external decision sources, but internally this module
// no longer needs it now that there is only one engine underneath.

const TO_CANONICAL: Record<PolicyAction, DecisionAction> = {
  allow: "allow",
  block: "deny",
  redact: "redact",
  alert_only: "warn",
  require_approval: "require_approval",
};

const FROM_CANONICAL: Record<DecisionAction, PolicyAction> = {
  allow: "allow",
  deny: "block",
  redact: "redact",
  warn: "alert_only",
  require_approval: "require_approval",
};

const KNOWN_FIELDS = new Set([
  "model",
  "provider",
  "costUsd",
  "cost_usd",
  "inputTokens",
  "input_tokens",
  "promptContains",
  "prompt_contains",
  "threatLevel",
  "threat_level",
  "agentId",
  "agent_id",
  "userId",
  "user_id",
  "toolName",
  "tool_name",
  "hourOfDay",
  "hour_of_day",
  "destination",
]);

const warnedUnknownFields = new Set<string>();

/**
 * Operational diagnostic only — does not affect evaluation. The package
 * engine's `getRuleFieldValue` already returns `""` for anything it
 * doesn't recognize (same fail-shape as before), so a condition on an
 * unknown field still just never matches. This only exists so a rule
 * author gets a log line instead of silent no-op.
 */
function warnUnknownFields(rules: PolicyRule[]): void {
  for (const rule of rules) {
    for (const condition of rule.conditions.rules) {
      if (KNOWN_FIELDS.has(condition.field) || warnedUnknownFields.has(condition.field)) continue;
      warnedUnknownFields.add(condition.field);
      logger.warn(
        { field: condition.field, ruleId: rule.ruleId },
        `[PolicyEngine] Rule references unrecognized field "${condition.field}" — this condition will never match.`,
      );
    }
  }
}

function toGenericRules(rules: PolicyRule[]): GenericRule[] {
  return rules.map((r) => ({
    ruleId: r.ruleId,
    name: r.name,
    priority: r.priority,
    enabled: r.enabled,
    conditions: r.conditions,
    action: TO_CANONICAL[r.action],
  }));
}

function toEvaluationContext(event: AIEventContext): EvaluationContext {
  return {
    model: event.model,
    provider: event.provider,
    toolName: event.toolCalls?.[0]?.name,
    toolCalls: event.toolCalls,
    costUsdSoFar: event.costUsd,
    inputTokens: event.inputTokens,
    prompt: event.prompt,
    threatLevel: event.threatLevel,
    agentId: event.agentId,
    userId: event.userId,
    timestamp: event.timestamp,
  };
}

/**
 * Evaluate an event against a list of rules. Delegates to
 * `@rakshex/policy-engine`'s generic-rules path — see the module doc
 * comment above. Return shape and behavior are unchanged from before the
 * unification for every existing caller.
 */
export function evaluatePolicy(event: AIEventContext, rules: PolicyRule[]): PolicyDecision {
  warnUnknownFields(rules);

  const decision = evaluatePackagePolicy(
    { version: 1, rules: toGenericRules(rules) },
    toEvaluationContext(event),
  );

  if (!decision.matchedRules.length) {
    return {
      action: "allow",
      matchedRuleId: null,
      matchedRuleName: null,
      reason: "No matching rule — default allow",
    };
  }

  const matchedRule = rules.find((r) => r.ruleId === decision.matchedRules[0]) ?? null;
  return {
    action: FROM_CANONICAL[decision.action],
    matchedRuleId: matchedRule?.ruleId ?? decision.matchedRules[0] ?? null,
    matchedRuleName: matchedRule?.name ?? null,
    reason: decision.reasons[0] ?? "",
  };
}
