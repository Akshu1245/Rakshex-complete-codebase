import { compilePolicy, hostMatches, normalizeModel, normalizeTool } from "./compile.js";
import type { CompiledPolicy, EvaluationContext, PolicyDecision, PolicyDocument } from "./types.js";

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
