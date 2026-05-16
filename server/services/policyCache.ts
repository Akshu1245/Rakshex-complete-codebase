/**
 * Redis Policy Cache — Caches workspace policy rules for fast enforcement.
 *
 * TTL: 60 seconds. Invalidated on create/update/delete.
 * This avoids a DB query on every AI call.
 */
import { redis } from "../_core/cache";
import { logger } from "../_core/logger";
import * as db from "../db";
import type { PolicyRule } from "../engines/policyEngine";

const CACHE_TTL = 60;
const KEY_PREFIX = "policy:rules:";

/**
 * Get cached policy rules for a workspace. Falls back to DB on cache miss.
 */
export async function getWorkspaceRules(
  workspaceId: string,
): Promise<PolicyRule[]> {
  const cacheKey = `${KEY_PREFIX}${workspaceId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PolicyRule[];
    }
  } catch {
    // Redis down — fall through to DB
  }

  // DB fallback
  try {
    const dbClient = await db.getDb();
    if (!dbClient) return [];

    const rows = await dbClient.execute(
      `SELECT rule_id, name, priority, enabled, conditions, action
       FROM policy_rules
       WHERE workspace_id = ? AND enabled = TRUE AND deleted_at IS NULL
       ORDER BY priority ASC`,
      [workspaceId],
    );

    const rules: PolicyRule[] = (
      rows as unknown as Array<{
        rule_id: string;
        name: string;
        priority: number;
        enabled: boolean;
        conditions: string;
        action: string;
      }>
    ).map((r) => {
      let conditions: PolicyRule["conditions"];
      try {
        conditions = JSON.parse(r.conditions);
      } catch {
        conditions = { operator: "AND", rules: [] };
      }
      return {
        ruleId: r.rule_id,
        name: r.name,
        priority: r.priority,
        enabled: r.enabled,
        conditions,
        action: r.action as PolicyRule["action"],
      };
    });

    // Cache in Redis
    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(rules));
    } catch {
      // Best effort
    }

    return rules;
  } catch (err) {
    logger.warn({ err }, "[PolicyCache] DB lookup failed");
    return [];
  }
}

/**
 * Invalidate the policy cache for a workspace.
 */
export async function invalidatePolicyCache(
  workspaceId: string,
): Promise<void> {
  try {
    await redis.del(`${KEY_PREFIX}${workspaceId}`);
  } catch {
    // Best effort
  }
}
