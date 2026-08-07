/**
 * Fast kill-switch state in Redis for low-latency gateway checks.
 * Postgres remains the durable source of truth.
 */
import { redis } from "../../_core/cache";
import { killSwitchRedisKey, type KillSwitchState } from "./enforcement";
import { logger } from "../../_core/logger";

const TTL_SECONDS = 60 * 60 * 24;

export interface CachedKillSwitch {
  isActive: boolean;
  budgetLimitUsd?: number;
  currentSpendUsd?: number;
  updatedAt: string;
  version?: number;
  workspaceId?: number;
  /** @deprecated legacy user-scoped cache */
  userId?: number;
}

export interface ScopedKillSwitchState {
  workspaceDisabled: boolean;
  identityDisabled: boolean;
  projectDisabled: boolean;
  agentDisabled: boolean;
  version: number;
  updatedAt: string;
}

export async function publishWorkspaceKillSwitch(
  workspaceId: number,
  state: Omit<CachedKillSwitch, "workspaceId" | "updatedAt" | "userId">,
): Promise<void> {
  const payload: CachedKillSwitch = {
    ...state,
    workspaceId,
    updatedAt: new Date().toISOString(),
  };
  const key = killSwitchRedisKey("workspace", String(workspaceId));
  try {
    await redis.setex(key, TTL_SECONDS, JSON.stringify(payload));
    if (typeof redis.publish === "function") {
      await redis.publish(`ag:kill:invalidate:${workspaceId}`, String(state.version ?? Date.now()));
    }
  } catch (err) {
    logger.warn(
      { err, workspaceId },
      "[KillSwitch] Redis publish failed — PG remains source of truth",
    );
  }
}

export async function publishScopedKillSwitch(input: {
  workspaceId: number;
  scopeType: "workspace" | "identity" | "project" | "agent";
  scopeId: string;
  active: boolean;
  version: number;
  reason?: string;
}): Promise<void> {
  // Identity must never share the agent Redis namespace — numeric identity IDs
  // and string agent IDs would otherwise collide and flip the wrong control.
  const key = killSwitchRedisKey(input.scopeType, `${input.workspaceId}:${input.scopeId}`);
  const payload = {
    active: input.active,
    version: input.version,
    reason: input.reason,
    updatedAt: new Date().toISOString(),
  };
  try {
    await redis.setex(key, TTL_SECONDS, JSON.stringify(payload));
    if (input.scopeType === "workspace") {
      await publishWorkspaceKillSwitch(input.workspaceId, {
        isActive: input.active,
        version: input.version,
      });
    }
  } catch (err) {
    logger.warn({ err, input }, "[KillSwitch] Scoped Redis publish failed");
  }
}

export async function readMergedKillSwitchState(opts: {
  workspaceId: number;
  identityId?: number;
  projectId?: string;
  agentId?: string;
}): Promise<ScopedKillSwitchState> {
  const readScope = async (scope: "workspace" | "identity" | "project" | "agent", id: string) => {
    try {
      const raw = await redis.get(killSwitchRedisKey(scope, `${opts.workspaceId}:${id}`));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { active?: boolean; isActive?: boolean };
      return Boolean(parsed.active ?? parsed.isActive);
    } catch {
      // Cache errors are not treated as "inactive". Callers that need durable
      // truth (evaluateGatewayGovernance) reconcile against Postgres.
      return false;
    }
  };

  const workspaceKey = killSwitchRedisKey("workspace", String(opts.workspaceId));
  let workspaceDisabled = false;
  try {
    const raw = await redis.get(workspaceKey);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedKillSwitch;
      workspaceDisabled = Boolean(parsed.isActive);
    }
  } catch {
    workspaceDisabled = false;
  }

  // Also honor the scoped workspace key written by publishScopedKillSwitch.
  if (!workspaceDisabled) {
    workspaceDisabled = await readScope("workspace", String(opts.workspaceId));
  }

  const identityDisabled = opts.identityId
    ? await readScope("identity", String(opts.identityId))
    : false;
  const projectDisabled = opts.projectId ? await readScope("project", opts.projectId) : false;
  const agentDisabled = opts.agentId ? await readScope("agent", opts.agentId) : false;

  return {
    workspaceDisabled,
    identityDisabled,
    projectDisabled,
    agentDisabled,
    version: Date.now(),
    updatedAt: new Date().toISOString(),
  };
}

/** @deprecated Use publishWorkspaceKillSwitch */
export async function publishKillSwitchState(
  userId: number,
  state: Omit<CachedKillSwitch, "userId" | "updatedAt" | "workspaceId">,
): Promise<void> {
  const payload: CachedKillSwitch = {
    ...state,
    userId,
    updatedAt: new Date().toISOString(),
  };
  const key = killSwitchRedisKey("workspace", `user:${userId}`);
  try {
    await redis.setex(key, TTL_SECONDS, JSON.stringify(payload));
  } catch (err) {
    logger.warn({ err, userId }, "[KillSwitch] Redis publish failed — PG remains source of truth");
  }
}

/** @deprecated Use readWorkspaceKillSwitchCache */
export async function readKillSwitchCache(userId: number): Promise<CachedKillSwitch | null> {
  const key = killSwitchRedisKey("workspace", `user:${userId}`);
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedKillSwitch;
  } catch {
    return null;
  }
}

export async function readWorkspaceKillSwitchCache(
  workspaceId: number,
): Promise<CachedKillSwitch | null> {
  const key = killSwitchRedisKey("workspace", String(workspaceId));
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedKillSwitch;
  } catch {
    return null;
  }
}

/** Map merged scoped state into enforcement KillSwitchState partials for gateway. */
export function toEnforcementKillState(
  scoped: ScopedKillSwitchState,
  extra?: Partial<KillSwitchState>,
): KillSwitchState {
  return {
    workspaceDisabled: scoped.workspaceDisabled,
    projectDisabled: scoped.projectDisabled,
    agentDisabled: scoped.agentDisabled || scoped.identityDisabled,
    updatedAt: scoped.updatedAt,
    ...extra,
  };
}
