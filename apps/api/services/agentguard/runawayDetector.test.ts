/**
 * Runaway-agent simulation harness — port of DevPulse
 * `simulate_runaway_agent.py` (Team D salvage, 2026-09-25).
 *
 * Each scenario drives the in-process RunawayDetector the way a misbehaving
 * agent would and asserts the trip fires. This is the enforcement story's
 * testing asset: `npx vitest run runawayDetector` replays all six.
 */
import { describe, expect, it } from "vitest";
import {
  RunawayDetector,
  runawayTripToRiskSignal,
  type RunawayDetectorConfig,
} from "./runawayDetector";

function simConfig(): Partial<RunawayDetectorConfig> {
  return {
    maxRequestsPerSecond: 3,
    requestWindowSeconds: 5,
    loopBurstThreshold: 10,
    maxCostPerMinuteUsd: 0.25,
    maxCostPerHourUsd: 1,
    maxDailyCostUsd: 5,
    maxThinkingOverheadMultiplier: 20,
    blockDurationSeconds: 3600, // long enough that the sim never auto-releases mid-scenario
  };
}

describe("runaway simulation: rate limit", () => {
  it("stops an agent firing 25 requests with no delay", () => {
    const detector = new RunawayDetector(simConfig());
    const agentId = "agent-rate-test-001";
    let trippedAt: number | null = null;

    // Vary endpoints so this is a pure rate burst, not a loop burst.
    const endpoints = ["/api/scan", "/api/compliance", "/api/postman", "/api/alerts"];
    for (let i = 1; i <= 25; i++) {
      if (detector.isBlocked(agentId).blocked) continue;
      const trip = detector.recordRequest(agentId, endpoints[i % endpoints.length]);
      if (trip) {
        trippedAt = i;
        expect(trip.reason).toBe("rate_limit");
      }
    }
    expect(trippedAt).not.toBeNull();
    expect(detector.isBlocked(agentId).blocked).toBe(true);
    expect(detector.getStatus(agentId)["tripCount"]).toBe(1);
  });
});

describe("runaway simulation: infinite loop", () => {
  it("stops an agent hammering one endpoint after normal traffic", () => {
    const detector = new RunawayDetector(simConfig());
    const agentId = "agent-loop-test-002";

    for (const ep of ["/api/compliance", "/api/postman", "/api/alerts"]) {
      expect(detector.recordRequest(agentId, ep)).toBeNull();
    }

    let trippedAt: number | null = null;
    for (let i = 1; i <= 20; i++) {
      if (detector.isBlocked(agentId).blocked) continue;
      const trip = detector.recordRequest(agentId, "/api/scan");
      if (trip) {
        trippedAt = i;
        expect(trip.reason).toBe("infinite_loop");
      }
    }
    expect(trippedAt).not.toBeNull();
    expect(detector.isBlocked(agentId).blocked).toBe(true);
  });
});

describe("runaway simulation: cost velocity spike", () => {
  it("blocks an LLM runaway before the daily budget burns", () => {
    const detector = new RunawayDetector(simConfig());
    const agentId = "agent-cost-test-003";
    const calls: Array<[string, number]> = [
      ["o1", 0.05],
      ["o1", 0.07],
      ["claude-opus-4", 0.08],
      ["o3", 0.06], // cumulative $0.26 — trips the $0.25/min cap
      ["o3", 0.08],
    ];

    let trippedAt: number | null = null;
    calls.forEach(([model, cost], i) => {
      if (detector.isBlocked(agentId).blocked) return;
      const trip = detector.recordLlmCall(agentId, { costUsd: cost, model });
      if (trip) {
        trippedAt = i + 1;
        expect(trip.reason).toBe("cost_per_minute");
        // cost trips map onto the existing policy-engine signal
        const signal = runawayTripToRiskSignal(trip);
        expect(signal).toMatchObject({ type: "budget_exceeded", severity: "high" });
      }
    });
    expect(trippedAt).not.toBeNull();
    expect(detector.isBlocked(agentId).blocked).toBe(true);
  });
});

describe("runaway simulation: thinking-token anomaly", () => {
  it("catches a 30x runaway reasoning chain on a single call", () => {
    const detector = new RunawayDetector(simConfig());
    const agentId = "agent-think-test-004";

    for (const overhead of [2.5, 3.1, 4.0]) {
      expect(
        detector.recordLlmCall(agentId, {
          costUsd: 0.01,
          thinkingOverheadMultiplier: overhead,
          model: "o3-mini",
        }),
      ).toBeNull();
    }

    const trip = detector.recordLlmCall(agentId, {
      costUsd: 0.45,
      thinkingOverheadMultiplier: 30,
      model: "claude-opus-4",
    });
    expect(trip).not.toBeNull();
    expect(trip!.reason).toBe("thinking_anomaly");
    // no RiskSignal counterpart yet — the trip event is the routing unit
    expect(runawayTripToRiskSignal(trip!)).toBeNull();
  });
});

describe("runaway simulation: manual kill + release", () => {
  it("blocks immediately and releases on operator command", () => {
    const detector = new RunawayDetector(simConfig());
    const agentId = "agent-manual-005";

    const trip = detector.manualKill(agentId, "simulation test");
    expect(trip.reason).toBe("manual");
    expect(detector.isBlocked(agentId).blocked).toBe(true);

    expect(detector.release(agentId)).toBe(true);
    expect(detector.isBlocked(agentId).blocked).toBe(false);
    expect(detector.release(agentId)).toBe(false);
  });
});

describe("runaway simulation: API key blocking", () => {
  it("blocks and unblocks a key id", () => {
    const detector = new RunawayDetector(simConfig());
    const keyId = "sk-openai-prod-key-abcdef";
    expect(detector.isApiKeyBlocked(keyId)).toBe(false);
    detector.blockApiKey(keyId);
    expect(detector.isApiKeyBlocked(keyId)).toBe(true);
    detector.unblockApiKey(keyId);
    expect(detector.isApiKeyBlocked(keyId)).toBe(false);
  });
});
