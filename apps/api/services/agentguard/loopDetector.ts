/**
 * AgentGuard autonomous loop / rate anomaly detector.
 *
 * Detects the runaway-agent failure mode described in the DevPulse AgentGuard
 * design: an AI agent stuck in an infinite reasoning loop that fires rapid LLM
 * calls (often with the same prompt) and burns budget. It uses a fixed-window
 * counter keyed per (workspace, agent):
 *
 *   - call rate: total gateway calls for the agent within the window
 *   - duplicate-prompt storm: identical prompt hash repeated within the window
 *
 * The counting is delegated to a tiny {@link LoopWindowStore} so the pure
 * detection logic is unit-testable without Redis. A Redis-backed store is
 * provided for the runtime gateway path.
 */

export interface LoopWindowStore {
  /**
   * Atomically increment the counter for `key` and return the new value. On
   * first increment the counter must be given a TTL of `windowSeconds`.
   */
  bump(key: string, windowSeconds: number): Promise<number>;
}

export interface LoopDetectorConfig {
  windowSeconds?: number;
  maxCallsPerWindow?: number;
  maxDuplicatePrompts?: number;
}

export interface LoopDetectionResult {
  loopDetected: boolean;
  reasons: string[];
  callsInWindow: number;
  duplicatePromptCount: number;
}

export const DEFAULT_LOOP_CONFIG: Required<LoopDetectorConfig> = {
  windowSeconds: 60,
  maxCallsPerWindow: 30,
  maxDuplicatePrompts: 5,
};

export async function detectAgentLoop(
  store: LoopWindowStore,
  params: { scopeKey: string; promptHash?: string },
  config: LoopDetectorConfig = {},
): Promise<LoopDetectionResult> {
  const windowSeconds = config.windowSeconds ?? DEFAULT_LOOP_CONFIG.windowSeconds;
  const maxCalls = config.maxCallsPerWindow ?? DEFAULT_LOOP_CONFIG.maxCallsPerWindow;
  const maxDuplicates = config.maxDuplicatePrompts ?? DEFAULT_LOOP_CONFIG.maxDuplicatePrompts;
  const reasons: string[] = [];

  const callsInWindow = await store.bump(`ag:loop:calls:${params.scopeKey}`, windowSeconds);

  let duplicatePromptCount = 0;
  if (params.promptHash) {
    duplicatePromptCount = await store.bump(
      `ag:loop:dup:${params.scopeKey}:${params.promptHash}`,
      windowSeconds,
    );
  }

  if (callsInWindow > maxCalls) {
    reasons.push(
      `agent call rate ${callsInWindow}/${windowSeconds}s exceeds ${maxCalls} — possible runaway agent loop`,
    );
  }
  if (duplicatePromptCount > maxDuplicates) {
    reasons.push(
      `identical prompt repeated ${duplicatePromptCount} times in ${windowSeconds}s — possible infinite reasoning loop`,
    );
  }

  return {
    loopDetected: reasons.length > 0,
    reasons,
    callsInWindow,
    duplicatePromptCount,
  };
}

/**
 * Build a {@link LoopWindowStore} backed by the app's Redis client (real
 * ioredis or the in-memory MockRedis). Returns null if no client is available,
 * in which case callers should skip loop detection (fail-open on detection).
 */
export function createRedisLoopStore(
  redis:
    | {
        incr: (key: string) => Promise<number>;
        expire: (key: string, seconds: number) => Promise<unknown>;
      }
    | null
    | undefined,
): LoopWindowStore | null {
  if (!redis || typeof redis.incr !== "function") return null;
  return {
    async bump(key, windowSeconds) {
      const value = await redis.incr(key);
      if (value === 1) {
        try {
          await redis.expire(key, windowSeconds);
        } catch {
          /* best effort TTL */
        }
      }
      return value;
    },
  };
}
