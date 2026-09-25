/**
 * Runaway-agent detector — in-process sliding-window tripwire.
 *
 * Salvaged from DevPulse `kill_switch.py` (Team D, 2026-09-25). This is the
 * *detection* layer: sub-second, no DB, no network. It complements the
 * policy-driven `evaluateRisk` in `engine.ts` — the detector notices the
 * runaway, the policy engine decides the action (revoke / rotate / alert).
 *
 * Trips on: request rate, same-endpoint loop bursts, cost velocity
 * (per-minute / per-hour / daily cap), and thinking-token anomalies.
 * Cost trips map to the existing `budget_exceeded` RiskSignal via
 * `runawayTripToRiskSignal`; rate/loop/thinking trips are returned as events
 * for the caller to route (wiring into evaluateRisk is Team B's seam).
 *
 * Enforcement boundary (repo AGENTS.md): this only sees traffic the caller
 * feeds it — RaksHex-routed traffic. Never claim it stops bypass traffic.
 */

export type RunawayTripReason =
  | "rate_limit"
  | "infinite_loop"
  | "cost_per_minute"
  | "cost_per_hour"
  | "daily_budget"
  | "thinking_anomaly"
  | "manual";

export interface RunawayTrip {
  agentId: string;
  reason: RunawayTripReason;
  detail: string;
  triggeredAt: string;
  metricsSnapshot: Record<string, unknown>;
  autoReleaseAt: string | null;
}

export interface RunawayDetectorConfig {
  maxRequestsPerSecond: number;
  requestWindowSeconds: number;
  loopBurstThreshold: number;
  maxCostPerMinuteUsd: number;
  maxCostPerHourUsd: number;
  maxDailyCostUsd: number;
  maxThinkingOverheadMultiplier: number;
  blockDurationSeconds: number; // 0 = manual release only
}

const DEFAULT_CONFIG: RunawayDetectorConfig = {
  maxRequestsPerSecond: 5,
  requestWindowSeconds: 10,
  loopBurstThreshold: 20,
  maxCostPerMinuteUsd: 1,
  maxCostPerHourUsd: 10,
  maxDailyCostUsd: 50,
  maxThinkingOverheadMultiplier: 25,
  blockDurationSeconds: 300,
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Build config from environment with the conservative defaults above. */
export function runawayConfigFromEnv(): RunawayDetectorConfig {
  return {
    maxRequestsPerSecond: numEnv("RUNAWAY_MAX_REQ_PER_SEC", DEFAULT_CONFIG.maxRequestsPerSecond),
    requestWindowSeconds: numEnv("RUNAWAY_REQ_WINDOW_SEC", DEFAULT_CONFIG.requestWindowSeconds),
    loopBurstThreshold: numEnv("RUNAWAY_LOOP_BURST", DEFAULT_CONFIG.loopBurstThreshold),
    maxCostPerMinuteUsd: numEnv("RUNAWAY_MAX_COST_PER_MIN_USD", DEFAULT_CONFIG.maxCostPerMinuteUsd),
    maxCostPerHourUsd: numEnv("RUNAWAY_MAX_COST_PER_HOUR_USD", DEFAULT_CONFIG.maxCostPerHourUsd),
    maxDailyCostUsd: numEnv("RUNAWAY_MAX_DAILY_COST_USD", DEFAULT_CONFIG.maxDailyCostUsd),
    maxThinkingOverheadMultiplier: numEnv(
      "RUNAWAY_MAX_THINKING_OVERHEAD",
      DEFAULT_CONFIG.maxThinkingOverheadMultiplier,
    ),
    blockDurationSeconds: numEnv("RUNAWAY_BLOCK_DURATION_SEC", DEFAULT_CONFIG.blockDurationSeconds),
  };
}

interface AgentState {
  requestTimes: number[];
  endpointCalls: Map<string, number[]>;
  costMinute: Array<[number, number]>;
  costHour: Array<[number, number]>;
  dailyCostUsd: number;
  dailyResetDate: string;
  blockedUntil: number; // epoch ms; 0 = not blocked; Infinity = manual release
  tripCount: number;
}

function freshState(): AgentState {
  return {
    requestTimes: [],
    endpointCalls: new Map(),
    costMinute: [],
    costHour: [],
    dailyCostUsd: 0,
    dailyResetDate: "",
    blockedUntil: 0,
    tripCount: 0,
  };
}

export class RunawayDetector {
  private readonly config: RunawayDetectorConfig;
  private readonly states = new Map<string, AgentState>();
  private readonly blockedApiKeys = new Set<string>();

  constructor(config: Partial<RunawayDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private stateFor(agentId: string): AgentState {
    let state = this.states.get(agentId);
    if (!state) {
      state = freshState();
      this.states.set(agentId, state);
    }
    return state;
  }

  /** True while a trip block is active; auto-releases when the duration lapses. */
  isBlocked(agentId: string): { blocked: boolean; reason: string } {
    const state = this.states.get(agentId);
    if (!state || state.blockedUntil <= 0) return { blocked: false, reason: "" };
    const now = Date.now();
    if (now < state.blockedUntil) {
      const remaining = Math.round((state.blockedUntil - now) / 100) / 10;
      return { blocked: true, reason: `Agent blocked for ${remaining}s more` };
    }
    state.blockedUntil = 0;
    return { blocked: false, reason: "" };
  }

  recordRequest(agentId: string, endpoint: string): RunawayTrip | null {
    const state = this.stateFor(agentId);
    const cfg = this.config;
    const now = Date.now();
    const windowMs = cfg.requestWindowSeconds * 1000;

    state.requestTimes.push(now);
    state.requestTimes = state.requestTimes.filter((t) => now - t <= windowMs);

    const epCalls = state.endpointCalls.get(endpoint) ?? [];
    epCalls.push(now);
    const pruned = epCalls.filter((t) => now - t <= windowMs);
    state.endpointCalls.set(endpoint, pruned);

    const rate = state.requestTimes.length / cfg.requestWindowSeconds;
    if (rate > cfg.maxRequestsPerSecond) {
      return this.trip(agentId, "rate_limit",
        `Request rate ${rate.toFixed(1)} req/s exceeds limit ${cfg.maxRequestsPerSecond} req/s`,
        { rateReqPerS: Math.round(rate * 100) / 100, threshold: cfg.maxRequestsPerSecond, windowS: cfg.requestWindowSeconds, endpoint });
    }
    if (pruned.length >= cfg.loopBurstThreshold) {
      return this.trip(agentId, "infinite_loop",
        `Endpoint '${endpoint}' called ${pruned.length} times in ${cfg.requestWindowSeconds}s (threshold=${cfg.loopBurstThreshold})`,
        { endpoint, callsInWindow: pruned.length, threshold: cfg.loopBurstThreshold, windowS: cfg.requestWindowSeconds });
    }
    return null;
  }

  recordLlmCall(
    agentId: string,
    input: { costUsd: number; thinkingOverheadMultiplier?: number; model?: string },
  ): RunawayTrip | null {
    const state = this.stateFor(agentId);
    const cfg = this.config;
    const now = Date.now();
    const costUsd = Math.max(0, input.costUsd);

    const today = new Date().toISOString().slice(0, 10);
    if (state.dailyResetDate !== today) {
      state.dailyCostUsd = 0;
      state.dailyResetDate = today;
    }
    state.dailyCostUsd += costUsd;

    state.costMinute.push([now, costUsd]);
    state.costHour.push([now, costUsd]);
    state.costMinute = state.costMinute.filter(([t]) => now - t <= 60_000);
    state.costHour = state.costHour.filter(([t]) => now - t <= 3_600_000);
    const lastMinute = state.costMinute.reduce((s, [, c]) => s + c, 0);
    const lastHour = state.costHour.reduce((s, [, c]) => s + c, 0);

    const overhead = input.thinkingOverheadMultiplier ?? 1;
    if (overhead >= cfg.maxThinkingOverheadMultiplier) {
      return this.trip(agentId, "thinking_anomaly",
        `Thinking overhead ${overhead.toFixed(1)}x exceeds limit ${cfg.maxThinkingOverheadMultiplier}x on model '${input.model ?? "unknown"}'`,
        { thinkingOverheadMultiplier: overhead, threshold: cfg.maxThinkingOverheadMultiplier, model: input.model ?? "unknown", costUsd });
    }
    if (lastMinute >= cfg.maxCostPerMinuteUsd) {
      return this.trip(agentId, "cost_per_minute",
        `Spend $${lastMinute.toFixed(4)} in last 60s exceeds limit $${cfg.maxCostPerMinuteUsd}/min`,
        { costLastMinuteUsd: Math.round(lastMinute * 10000) / 10000, thresholdUsd: cfg.maxCostPerMinuteUsd, model: input.model ?? "unknown" });
    }
    if (lastHour >= cfg.maxCostPerHourUsd) {
      return this.trip(agentId, "cost_per_hour",
        `Spend $${lastHour.toFixed(4)} in last 60 min exceeds limit $${cfg.maxCostPerHourUsd}/hr`,
        { costLastHourUsd: Math.round(lastHour * 10000) / 10000, thresholdUsd: cfg.maxCostPerHourUsd, model: input.model ?? "unknown" });
    }
    if (state.dailyCostUsd >= cfg.maxDailyCostUsd) {
      return this.trip(agentId, "daily_budget",
        `Daily spend $${state.dailyCostUsd.toFixed(4)} exceeds daily budget $${cfg.maxDailyCostUsd}`,
        { dailyCostUsd: Math.round(state.dailyCostUsd * 10000) / 10000, thresholdUsd: cfg.maxDailyCostUsd, model: input.model ?? "unknown" });
    }
    return null;
  }

  manualKill(agentId: string, reason = "Manually triggered by operator"): RunawayTrip {
    return this.trip(agentId, "manual", reason, {});
  }

  release(agentId: string): boolean {
    const state = this.states.get(agentId);
    if (state && state.blockedUntil > 0) {
      state.blockedUntil = 0;
      return true;
    }
    return false;
  }

  getStatus(agentId: string): Record<string, unknown> {
    const state = this.states.get(agentId);
    if (!state) return { agentId, status: "unknown" };
    const { blocked, reason } = this.isBlocked(agentId);
    const now = Date.now();
    const windowMs = this.config.requestWindowSeconds * 1000;
    const recent = state.requestTimes.filter((t) => now - t <= windowMs).length;
    return {
      agentId,
      status: blocked ? "blocked" : "active",
      blockMessage: reason,
      tripCount: state.tripCount,
      metrics: {
        requestRatePerS: Math.round((recent / this.config.requestWindowSeconds) * 1000) / 1000,
        costLastMinuteUsd: Math.round(state.costMinute.reduce((s, [, c]) => s + c, 0) * 10000) / 10000,
        costLastHourUsd: Math.round(state.costHour.reduce((s, [, c]) => s + c, 0) * 10000) / 10000,
        dailyCostUsd: Math.round(state.dailyCostUsd * 10000) / 10000,
      },
    };
  }

  blockApiKey(apiKeyId: string): void {
    this.blockedApiKeys.add(apiKeyId);
  }

  unblockApiKey(apiKeyId: string): void {
    this.blockedApiKeys.delete(apiKeyId);
  }

  isApiKeyBlocked(apiKeyId: string): boolean {
    return this.blockedApiKeys.has(apiKeyId);
  }

  private trip(
    agentId: string,
    reason: RunawayTripReason,
    detail: string,
    metricsSnapshot: Record<string, unknown>,
  ): RunawayTrip {
    const state = this.stateFor(agentId);
    state.tripCount += 1;
    const now = Date.now();
    let autoReleaseAt: string | null = null;
    if (this.config.blockDurationSeconds > 0) {
      state.blockedUntil = now + this.config.blockDurationSeconds * 1000;
      autoReleaseAt = new Date(state.blockedUntil).toISOString();
    } else {
      state.blockedUntil = Number.POSITIVE_INFINITY;
    }
    return {
      agentId,
      reason,
      detail,
      triggeredAt: new Date(now).toISOString(),
      metricsSnapshot,
      autoReleaseAt,
    };
  }
}

/**
 * Map a cost-based trip onto the existing AgentGuard RiskSignal union so the
 * policy engine (`evaluateRisk`) can act on it. Rate/loop/thinking trips have
 * no RiskSignal counterpart yet — route them via the trip event until Team B
 * extends the union.
 */
export function runawayTripToRiskSignal(trip: RunawayTrip): {
  type: "budget_exceeded";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
} | null {
  if (
    trip.reason !== "cost_per_minute" &&
    trip.reason !== "cost_per_hour" &&
    trip.reason !== "daily_budget"
  ) {
    return null;
  }
  return {
    type: "budget_exceeded",
    severity: trip.reason === "daily_budget" ? "critical" : "high",
    description: `[runaway-detector] ${trip.detail}`,
  };
}
