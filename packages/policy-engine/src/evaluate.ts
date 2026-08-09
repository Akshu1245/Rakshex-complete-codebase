import { compilePolicy, hostMatches, normalizeModel, normalizeTool } from "./compile.js";
import type {
  CompiledPolicy,
  ConditionOp,
  EvaluationContext,
  GenericRule,
  PolicyDecision,
  PolicyDocument,
  RuleCondition,
} from "./types.js";

// --- Generic prioritized rules ------------------------------------------
//
// This block is the mechanism that absorbed the second policy engine
// (formerly `apps/api/engines/policyEngine.ts`) into this package. See
// `GenericRule` in types.ts for the field-level rationale.

const THREAT_ORDER: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function compareThreatLevel(actual: string, op: string, value: string): boolean {
  const a = THREAT_ORDER[actual] ?? -1;
  const v = THREAT_ORDER[value] ?? -1;
  if (a < 0 || v < 0) return false;
  switch (op) {
    case "gt":
      return a > v;
    case "lt":
      return a < v;
    case "gte":
      return a >= v;
    case "lte":
      return a <= v;
    default:
      return false;
  }
}

const regexCache = new Map<string, RegExp>();
function getRegex(pattern: string): RegExp {
  let r = regexCache.get(pattern);
  if (!r) {
    r = new RegExp(pattern, "i");
    regexCache.set(pattern, r);
  }
  return r;
}

function getRuleFieldValue(ctx: EvaluationContext, field: string): unknown {
  switch (field) {
    case "model":
      return ctx.model ?? "";
    case "provider":
      return ctx.provider ?? "";
    case "costUsd":
    case "cost_usd":
      return ctx.costUsdSoFar ?? 0;
    case "inputTokens":
    case "input_tokens":
      return ctx.inputTokens ?? 0;
    case "promptContains":
    case "prompt_contains":
      return ctx.prompt ?? "";
    case "threatLevel":
    case "threat_level":
      return ctx.threatLevel ?? "none";
    case "agentId":
    case "agent_id":
      return ctx.agentId ?? "";
    case "userId":
    case "user_id":
      return ctx.userId ?? "";
    case "toolName":
    case "tool_name":
      return ctx.toolCalls?.map((t) => t.name).join(",") ?? ctx.toolName ?? "";
    case "destination":
      return ctx.destination ?? "";
    case "hourOfDay":
    case "hour_of_day":
      return (ctx.timestamp ?? new Date()).getUTCHours();
    default:
      return "";
  }
}

function evaluateRuleCondition(condition: RuleCondition, ctx: EvaluationContext): boolean {
  const actual = getRuleFieldValue(ctx, condition.field);

  if (condition.field === "threatLevel" || condition.field === "threat_level") {
    if (["gt", "lt", "gte", "lte"].includes(condition.op)) {
      return compareThreatLevel(String(actual), condition.op, String(condition.value));
    }
  }

  if ((condition.field === "toolName" || condition.field === "tool_name") && condition.op === "eq") {
    const tools = ctx.toolCalls?.map((t) => t.name) ?? (ctx.toolName ? [ctx.toolName] : []);
    return tools.some((t) => t === String(condition.value));
  }

  const op: ConditionOp = condition.op;
  switch (op) {
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
      return String(actual).toLowerCase().includes(String(condition.value).toLowerCase());
    case "between": {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) return false;
      const num = Number(actual);
      return num >= Number(condition.value[0]) && num <= Number(condition.value[1]);
    }
    default:
      return false;
  }
}

function evaluateRuleGroup(conditions: GenericRule["conditions"], ctx: EvaluationContext): boolean {
  const results = conditions.rules.map((c) => evaluateRuleCondition(c, ctx));
  return conditions.operator === "AND" ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Evaluate a document's `rules` list against a context. Returns null when
 * there are no rules or none match, so the caller can fall through to the
 * structured agent/models/tools/network/data checks.
 */
function evaluateGenericRules(
  rules: GenericRule[] | undefined,
  ctx: EvaluationContext,
): PolicyDecision | null {
  if (!rules?.length) return null;
  const sorted = rules
    .filter((r) => r.enabled !== false)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (evaluateRuleGroup(rule.conditions, ctx)) {
      return {
        action: rule.action,
        reasons: [`Matched rule "${rule.name ?? rule.ruleId}" (priority ${rule.priority})`],
        matchedRules: [rule.ruleId],
      };
    }
  }
  return null;
}

// --- Structured policy evaluation ---------------------------------------

/**
 * Evaluate a compiled policy (or document) against a runtime context.
 * Pure function — no I/O. Safe for dry-run and unit tests.
 */
export function evaluatePolicy(
  policy: PolicyDocument | CompiledPolicy,
  ctx: EvaluationContext,
): PolicyDecision {
  const compiled: CompiledPolicy =
    "document" in policy && "allowedModels" in policy
      ? (policy as CompiledPolicy)
      : compilePolicy(policy as PolicyDocument);

  // Generic priority rules run first and can override category order —
  // see GenericRule's doc comment in types.ts.
  const genericDecision = evaluateGenericRules(compiled.document.rules, ctx);
  if (genericDecision) return genericDecision;

  const reasons: string[] = [];
  const matchedRules: string[] = [];
  const agent = compiled.document.agent;

  // Agent limits
  if (agent?.max_steps != null && ctx.step != null && ctx.step > agent.max_steps) {
    matchedRules.push("agent.max_steps");
    reasons.push(`Step ${ctx.step} exceeds max_steps ${agent.max_steps}`);
    return { action: "deny", reasons, matchedRules };
  }
  if (agent?.max_retries != null && ctx.retryCount != null && ctx.retryCount > agent.max_retries) {
    matchedRules.push("agent.max_retries");
    reasons.push(`Retry count ${ctx.retryCount} exceeds max_retries ${agent.max_retries}`);
    return { action: "deny", reasons, matchedRules };
  }
  if (
    agent?.max_cost_usd != null &&
    ctx.costUsdSoFar != null &&
    ctx.costUsdSoFar > agent.max_cost_usd
  ) {
    matchedRules.push("agent.max_cost_usd");
    reasons.push(
      `Cost $${ctx.costUsdSoFar.toFixed(4)} exceeds max_cost_usd $${agent.max_cost_usd}`,
    );
    return { action: "deny", reasons, matchedRules };
  }
  if (
    agent?.timeout_seconds != null &&
    ctx.elapsedSeconds != null &&
    ctx.elapsedSeconds > agent.timeout_seconds
  ) {
    matchedRules.push("agent.timeout_seconds");
    reasons.push(`Elapsed ${ctx.elapsedSeconds}s exceeds timeout_seconds ${agent.timeout_seconds}`);
    return { action: "deny", reasons, matchedRules };
  }

  // Models
  if (ctx.model) {
    const model = normalizeModel(ctx.provider ? `${ctx.provider}/${ctx.model}` : ctx.model);
    const bare = normalizeModel(ctx.model);
    if (
      [...compiled.deniedModels].some((d) => model === d || bare === d || model.endsWith(`/${d}`))
    ) {
      matchedRules.push("models.deny");
      reasons.push(`Model ${ctx.model} is denied`);
      return { action: "deny", reasons, matchedRules };
    }
    if (compiled.allowedModels) {
      const ok = [...compiled.allowedModels].some(
        (a) => model === a || bare === a || model.endsWith(`/${a}`) || a.endsWith(`/${bare}`),
      );
      if (!ok) {
        matchedRules.push("models.allow");
        reasons.push(`Model ${ctx.model} is not on the allowlist`);
        return { action: "deny", reasons, matchedRules };
      }
    }
  }

  // Tools
  if (ctx.toolName) {
    const tool = normalizeTool(ctx.toolName);
    if (compiled.deniedTools.has(tool)) {
      matchedRules.push("tools.deny");
      reasons.push(`Tool ${ctx.toolName} is denied`);
      return { action: "deny", reasons, matchedRules };
    }
    if (compiled.approvalTools.has(tool)) {
      matchedRules.push("tools.require_approval");
      reasons.push(`Tool ${ctx.toolName} requires human approval`);
      return { action: "require_approval", reasons, matchedRules };
    }
    if (compiled.allowedTools && !compiled.allowedTools.has(tool)) {
      matchedRules.push("tools.allow");
      reasons.push(`Tool ${ctx.toolName} is not on the allowlist`);
      return { action: "deny", reasons, matchedRules };
    }
    if (compiled.denyToolsByDefault && !compiled.allowedTools?.has(tool)) {
      matchedRules.push("tools.deny_by_default");
      reasons.push(`Tool ${ctx.toolName} blocked by deny_by_default`);
      return { action: "deny", reasons, matchedRules };
    }
  }

  // Network
  if (ctx.destination) {
    const host =
      ctx.destination
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0] ?? "";
    if (compiled.denyDomains.some((d) => hostMatches(host, d))) {
      matchedRules.push("network.deny_domains");
      reasons.push(`Destination ${host} is denied`);
      return { action: "deny", reasons, matchedRules };
    }
    if (compiled.allowDomains && !compiled.allowDomains.some((d) => hostMatches(host, d))) {
      matchedRules.push("network.allow_domains");
      reasons.push(`Destination ${host} is not on the allowlist`);
      return { action: "deny", reasons, matchedRules };
    }
  }

  // Data / DLP labels
  if (ctx.dataLabels?.length) {
    const labels = ctx.dataLabels.map((l) => l.toLowerCase());
    const blocked = labels.filter((l) => compiled.blockLabels.has(l));
    if (blocked.length > 0) {
      matchedRules.push("data.block");
      reasons.push(`Blocked data labels: ${blocked.join(", ")}`);
      return {
        action: compiled.dataAction === "block" ? "deny" : "redact",
        reasons,
        matchedRules,
        redactionLabels: blocked,
      };
    }
    const redact = labels.filter((l) => compiled.redactLabels.has(l));
    if (redact.length > 0) {
      matchedRules.push("data.redact");
      reasons.push(`Redact data labels: ${redact.join(", ")}`);
      return { action: "redact", reasons, matchedRules, redactionLabels: redact };
    }
  }

  return { action: "allow", reasons: ["No policy violations"], matchedRules };
}

/** Simulate many contexts (policy test suite / dry-run). */
export function simulatePolicy(
  policy: PolicyDocument,
  cases: EvaluationContext[],
): Array<{ context: EvaluationContext; decision: PolicyDecision }> {
  const compiled = compilePolicy(policy);
  return cases.map((context) => ({
    context,
    decision: evaluatePolicy(compiled, { ...context, dryRun: true }),
  }));
}
