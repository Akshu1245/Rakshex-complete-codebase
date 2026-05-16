/**
 * Policy Engine — Evaluates AI telemetry events against workspace rules.
 *
 * Pure function — no DB calls. Rules are evaluated in priority order
 * (lowest number = highest priority), first match wins.
 *
 * Performance target: < 50ms for 1000 rules.
 */

export type PolicyAction =
  | "allow"
  | "block"
  | "redact"
  | "alert_only"
  | "require_approval";

export type ConditionOp =
  | "eq"
  | "in"
  | "not_in"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "regex"
  | "keyword"
  | "between";

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

// Cache compiled regex patterns
const regexCache = new Map<string, RegExp>();

function getRegex(pattern: string): RegExp {
  let r = regexCache.get(pattern);
  if (!r) {
    r = new RegExp(pattern, "i");
    regexCache.set(pattern, r);
  }
  return r;
}

function getFieldValue(
  event: AIEventContext,
  field: string,
): unknown {
  switch (field) {
    case "model":
      return event.model;
    case "provider":
      return event.provider;
    case "cost_usd":
      return event.costUsd;
    case "input_tokens":
      return event.inputTokens;
    case "prompt_contains":
      return event.prompt;
    case "threat_level":
      return event.threatLevel;
    case "agent_id":
      return event.agentId;
    case "user_id":
      return event.userId ?? "";
    case "tool_name":
      return event.toolCalls?.map((t) => t.name).join(",") ?? "";
    case "hour_of_day":
      return event.timestamp.getHours();
    default:
      return "";
  }
}

function evaluateCondition(
  condition: Condition,
  event: AIEventContext,
): boolean {
  const actual = getFieldValue(event, condition.field);

  switch (condition.op) {
    case "eq":
      return String(actual) === String(condition.value);
    case "in":
      return Array.isArray(condition.value)
        ? condition.value.some((v) => String(v) === String(actual))
        : String(condition.value) === String(actual);
    case "not_in":
      return Array.isArray(condition.value)
        ? !condition.value.some((v) => String(v) === String(actual))
        : String(condition.value) !== String(actual);
    case "gt":
      return Number(actual) > Number(condition.value);
    case "lt":
      return Number(actual) < Number(condition.value);
    case "gte":
      return Number(actual) >= Number(condition.value);
    case "lte":
      return Number(actual) <= Number(condition.value);
    case "regex":
      return getRegex(String(condition.value)).test(String(actual));
    case "keyword":
      return String(actual)
        .toLowerCase()
        .includes(String(condition.value).toLowerCase());
    case "between": {
      if (!Array.isArray(condition.value) || condition.value.length !== 2)
        return false;
      const num = Number(actual);
      return num >= Number(condition.value[0]) && num <= Number(condition.value[1]);
    }
    default:
      return false;
  }
}

function evaluateRuleGroup(
  conditions: PolicyRule["conditions"],
  event: AIEventContext,
): boolean {
  const results = conditions.rules.map((c) => evaluateCondition(c, event));
  if (conditions.operator === "AND") {
    return results.every(Boolean);
  }
  return results.some(Boolean);
}

/**
 * Evaluate an event against a list of rules. Rules are sorted by priority
 * (ascending) and the first matching enabled rule determines the result.
 */
export function evaluatePolicy(
  event: AIEventContext,
  rules: PolicyRule[],
): PolicyDecision {
  const sorted = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (evaluateRuleGroup(rule.conditions, event)) {
      return {
        action: rule.action,
        matchedRuleId: rule.ruleId,
        matchedRuleName: rule.name,
        reason: `Matched rule "${rule.name}" (priority ${rule.priority})`,
      };
    }
  }

  return {
    action: "allow",
    matchedRuleId: null,
    matchedRuleName: null,
    reason: "No matching rule — default allow",
  };
}
