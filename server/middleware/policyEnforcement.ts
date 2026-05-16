/**
 * Policy Enforcement Middleware — Runs policy engine on telemetry ingest
 * and takes action based on the decision (block, redact, alert, approve).
 */
import { evaluatePolicy, type AIEventContext, type PolicyDecision } from "../engines/policyEngine";
import { getWorkspaceRules } from "../services/policyCache";
import { logger } from "../_core/logger";
import { RuntimePolicyError } from "../_core/errors";
import * as db from "../db";
import crypto from "crypto";

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
    return { action: "allow", matchedRuleId: null, matchedRuleName: null, reason: "No rules configured" };
  }

  const decision = evaluatePolicy(event, rules);

  switch (decision.action) {
    case "block":
      logger.warn(
        { rule: decision.matchedRuleName, workspaceId },
        "[Policy] Request blocked by policy",
      );
      throw new RuntimePolicyError(
        `Blocked by policy: ${decision.matchedRuleName}`,
        {
          context: {
            workspaceId,
            ruleId: decision.matchedRuleId,
            ruleName: decision.matchedRuleName,
          },
        },
      );

    case "require_approval":
      try {
        const dbClient = await db.getDb();
        if (dbClient) {
          await dbClient.execute(
            `INSERT INTO pending_approvals (approval_id, workspace_id, rule_id, event_snapshot)
             VALUES (?, ?, ?, ?)`,
            [
              `appr_${crypto.randomBytes(8).toString("hex")}`,
              workspaceId,
              decision.matchedRuleId,
              JSON.stringify({
                model: event.model,
                provider: event.provider,
                costUsd: event.costUsd,
                inputTokens: event.inputTokens,
                threatLevel: event.threatLevel,
                agentId: event.agentId,
                timestamp: event.timestamp.toISOString(),
              }),
            ],
          );
        }
      } catch (err) {
        logger.warn({ err }, "[Policy] Failed to create approval request");
      }
      throw new RuntimePolicyError(
        `Requires approval: ${decision.matchedRuleName}`,
        {
          context: { workspaceId, ruleId: decision.matchedRuleId },
          safeMessage: "This request requires approval before processing.",
        },
      );

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
