/**
 * Autonomous AgentGuard engine.
 * Evaluates risk signals against policies and executes auto-kill actions.
 */
import { logger } from "../../_core/logger";
import * as db from "../../db";
import {
  agentGuardPolicies,
  agentGuardEvents,
  azureDiscoveredKeys,
} from "@rakshex/database/schema-enterprise";
import { eq, and } from "drizzle-orm";
import { AzureKeyVaultClient } from "../azure/keyVaultClient";
import { randomUUID } from "../../utils/crypto";

export interface RiskSignal {
  type: "leak_detected" | "overprivileged" | "expired_key" | "shadow_key" | "budget_exceeded";
  severity: "low" | "medium" | "high" | "critical";
  keyId?: number;
  keyName?: string;
  resourceName?: string;
  description: string;
}

type ActionResult = "success" | "failed";

/**
 * Evaluate a risk signal against all active AgentGuard policies.
 */
export async function evaluateRisk(
  workspaceId: number,
  signal: RiskSignal,
): Promise<{ matched: boolean; actions: string[] }> {
  const dbConn = await db.getDb();
  if (!dbConn) return { matched: false, actions: [] };

  const policies = await dbConn
    .select()
    .from(agentGuardPolicies)
    .where(
      and(eq(agentGuardPolicies.workspaceId, workspaceId), eq(agentGuardPolicies.isEnabled, true)),
    );

  const actions: string[] = [];
  let matched = false;

  for (const policy of policies) {
    const triggers = policy.triggers as Array<{ event: string; severity: string }>;
    const matches = triggers.some(
      (t) => t.event === signal.type && severityRank(t.severity) >= severityRank(signal.severity),
    );
    if (!matches) continue;
    matched = true;

    try {
      const { ok, message } = await executeAction(workspaceId, signal, policy.action, policy.name);
      actions.push(message);

      await dbConn.insert(agentGuardEvents).values({
        workspaceId,
        policyId: policy.id,
        trigger: signal.type as "leak_detected",
        action: policy.action,
        targetKeyId: signal.keyId,
        targetKeyName: signal.keyName,
        severity: signal.severity,
        reason: signal.description,
        result: ok ? "success" : "failed",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, policyId: policy.id }, "[AgentGuard] Action failed");
      actions.push(`failed: ${policy.action} — ${msg}`);
    }
  }

  return { matched, actions };
}

async function executeAction(
  workspaceId: number,
  signal: RiskSignal,
  action: "revoke" | "rotate" | "alert_only" | "disable",
  policyName: string,
): Promise<{ ok: boolean; message: string }> {
  logger.info(
    { workspaceId, action, signalType: signal.type, keyName: signal.keyName },
    "[AgentGuard] Executing action",
  );

  switch (action) {
    case "alert_only":
      return { ok: true, message: `alert: ${policyName} — ${signal.description}` };

    case "revoke": {
      if (!signal.keyId) return { ok: false, message: `revoke: no keyId for "${signal.keyName}"` };
      const dc = await db.getDb();
      if (dc)
        await dc
          .update(azureDiscoveredKeys)
          .set({ status: "revoked" })
          .where(eq(azureDiscoveredKeys.id, signal.keyId));
      return { ok: true, message: `revoked: "${signal.keyName}" per "${policyName}"` };
    }

    case "disable": {
      if (!signal.keyId) return { ok: false, message: `disable: no keyId for "${signal.keyName}"` };
      const dd = await db.getDb();
      if (dd)
        await dd
          .update(azureDiscoveredKeys)
          .set({ status: "disabled" })
          .where(eq(azureDiscoveredKeys.id, signal.keyId));
      return { ok: true, message: `disabled: "${signal.keyName}" per "${policyName}"` };
    }

    case "rotate": {
      if (!signal.keyId) return { ok: false, message: `rotate: no keyId` };
      const dr = await db.getDb();
      if (!dr) return { ok: false, message: "rotate: no database" };

      const key = (
        await dr
          .select()
          .from(azureDiscoveredKeys)
          .where(eq(azureDiscoveredKeys.id, signal.keyId))
          .limit(1)
      )[0];
      if (!key || key.resourceType !== "keyVault" || !key.resourceName) {
        return { ok: false, message: `rotate: no vault/secret for key ${signal.keyId}` };
      }

      const newValue = randomUUID() + randomUUID();
      const ok = await AzureKeyVaultClient.rotateSecret(key.resourceName, key.keyName, newValue);
      if (ok) {
        await dr
          .update(azureDiscoveredKeys)
          .set({ status: "active", expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) })
          .where(eq(azureDiscoveredKeys.id, signal.keyId));
        return { ok: true, message: `rotated: "${key.keyName}" in ${key.resourceName}` };
      }
      return { ok: false, message: `rotate: SDK returned false for "${key.keyName}"` };
    }

    default:
      return { ok: false, message: `unknown action: ${action}` };
  }
}

function severityRank(s: string): number {
  const ranks: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  return ranks[s] ?? 0;
}
