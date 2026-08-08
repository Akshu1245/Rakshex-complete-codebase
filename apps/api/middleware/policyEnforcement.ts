/**
 * Policy Enforcement — runs policy engine rules and takes action based on
 * the decision (block, redact, alert, approve).
 *
 * Called from two places with different data availability:
 *   - Pre-flight, in the gateway proxies (anthropicProxy.ts/openAiProxy.ts),
 *     via buildPreflightEventContext — this is the only point that can
 *     actually block a call before it happens. `inputTokens` isn't known
 *     yet at this point (only an estimate exists), and `threatLevel` is
 *     always "none" here since no pre-flight adversarial-intent scan is
 *     wired into the gateway proxies yet — rules relying on those fields
 *     will not fire pre-flight.
 *   - Post-hoc, from telemetry ingest, with the full completed-call data
 *     (exact tokens, latency, status) — useful for reactive rules
 *     (escalating alerts, flagging for review) but cannot block a call
 *     that already happened.
 */
import { evaluatePolicy, type AIEventContext, type PolicyDecision } from "../engines/policyEngine";
import { getWorkspaceRules } from "../services/policyCache";
import { logger } from "../_core/logger";
import { RuntimePolicyError } from "../_core/errors";
import * as db from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

function extractPromptText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const parts: string[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const content = (m as Record<string, unknown>).content;
    if (typeof content === "string") {
      parts.push(content);
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === "object") {
          const text = (block as Record<string, unknown>).text;
          if (typeof text === "string") parts.push(text);
        }
      }
    }
  }
  // Capped — this is evaluated in-memory for a single request and never
  // persisted, consistent with keeping prompts out of storage by default.
  return parts.join("\n").slice(0, 8000);
}

function extractToolNames(tools: unknown): string[] {
  if (!Array.isArray(tools)) return [];
  const names: string[] = [];
  for (const t of tools) {
    if (!t || typeof t !== "object") continue;
    const record = t as Record<string, unknown>;
    const fn = record.function as Record<string, unknown> | undefined;
    const name = record.name ?? fn?.name;
    if (typeof name === "string") names.push(name);
  }
  return names;
}

/**
 * Build an AIEventContext from data available before a gateway call is
 * made. See the module-level comment for what's NOT available yet here.
 */
export function buildPreflightEventContext(params: {
  model: string;
  provider: string;
  estimatedCostUsd: number;
  agentId?: string;
  userId?: string;
  messages?: unknown;
  tools?: unknown;
}): AIEventContext {
  return {
    model: params.model,
    provider: params.provider,
    costUsd: params.estimatedCostUsd,
    inputTokens: 0,
    prompt: extractPromptText(params.messages),
    threatLevel: "none",
    agentId: params.agentId ?? "unknown",
    userId: params.userId,
    toolCalls: extractToolNames(params.tools).map((name) => ({ name })),
    timestamp: new Date(),
  };
}

/**
 * Enforce workspace policies on an incoming telemetry event.
 * Returns the resolved decision. Throws RuntimePolicyError if block.
 */
export async function enforcePolicies(
  event: AIEventContext,
  workspaceId: string,
): Promise<PolicyDecision> {
  const rules = await getWorkspaceRules(workspaceId);
  if (rules.length === 0) {
    return {
      action: "allow",
      matchedRuleId: null,
      matchedRuleName: null,
      reason: "No rules configured",
    };
  }

  const decision = evaluatePolicy(event, rules);

  switch (decision.action) {
    case "block":
      logger.warn(
        { rule: decision.matchedRuleName, workspaceId },
        "[Policy] Request blocked by policy",
      );
      throw new RuntimePolicyError(`Blocked by policy: ${decision.matchedRuleName}`, {
        context: {
          workspaceId,
          ruleId: decision.matchedRuleId,
          ruleName: decision.matchedRuleName,
        },
      });

    case "require_approval":
      try {
        const dbClient = await db.getDb();
        if (dbClient) {
          const snapshot = JSON.stringify({
            model: event.model,
            provider: event.provider,
            costUsd: event.costUsd,
            inputTokens: event.inputTokens,
            threatLevel: event.threatLevel,
            agentId: event.agentId,
            timestamp: event.timestamp.toISOString(),
          });
          await dbClient.execute(
            sql`INSERT INTO pending_approvals (approval_id, workspace_id, rule_id, event_snapshot) VALUES (${`appr_${crypto.randomBytes(8).toString("hex")}`}, ${workspaceId}, ${decision.matchedRuleId}, ${snapshot})`,
          );
        }
      } catch (err) {
        logger.warn({ err }, "[Policy] Failed to create approval request");
      }
      throw new RuntimePolicyError(`Requires approval: ${decision.matchedRuleName}`, {
        context: { workspaceId, ruleId: decision.matchedRuleId },
        safeMessage: "This request requires approval before processing.",
      });

    case "alert_only":
      logger.warn(
        { rule: decision.matchedRuleName, workspaceId, model: event.model },
        "[Policy] Alert triggered",
      );
      break;

    case "allow":
    default:
      break;
  }

  return decision;
}
