/**
 * Fast kill-switch state in Redis for low-latency gateway checks.
 * Postgres remains the durable source of truth.
 */
import { redis } from "../../_core/cache";
import { killSwitchRedisKey } from "./enforcement";
import { logger } from "../../_core/logger";

const TTL_SECONDS = 60 * 60 * 24; // 24h; refreshed on every toggle

export interface CachedKillSwitch {
  isActive: boolean;
  budgetLimitUsd?: number;
  currentSpendUsd?: number;
  updatedAt: string;
  userId: number;
}

export async function publishKillSwitchState(
  userId: number,
  state: Omit<CachedKillSwitch, "userId" | "updatedAt">,
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
