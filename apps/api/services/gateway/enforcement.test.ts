import { describe, expect, it } from "vitest";
import {
  decideEnforcement,
  enforceRequest,
  killSwitchRedisKey,
  mergeKillSwitchState,
  type KillSwitchState,
} from "./enforcement";

const baseState = (): KillSwitchState => ({
  workspaceDisabled: false,
  projectDisabled: false,
  agentDisabled: false,
  updatedAt: new Date().toISOString(),
});

describe("gateway enforcement", () => {
  it("blocks disabled agents from calling providers", () => {
    const result = decideEnforcement(
      {
        workspaceId: "ws1",
        agentId: "ag1",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 0.01,
      },
      { ...baseState(), agentDisabled: true },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("agent kill switch is active");
  });

  it("budget limits stop subsequent requests", () => {
    const result = decideEnforcement(
      {
        workspaceId: "ws1",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 5,
      },
      {
        ...baseState(),
        budgetLimitUsd: 10,
        currentSpendUsd: 8,
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.includes("budget"))).toBe(true);
  });

  it("emergency bypass requires explicit flag and is audited", () => {
    const result = decideEnforcement(
      {
        workspaceId: "ws1",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 1,
        emergencyBypass: true,
        bypassGrantedBy: "security-admin",
      },
      { ...baseState(), workspaceDisabled: true },
    );
    expect(result.allowed).toBe(true);
    expect(result.audit.emergencyBypass).toBe(true);
    expect(result.audit.bypassGrantedBy).toBe("security-admin");
  });

  it("provider and model allowlists are enforced", () => {
    const result = decideEnforcement(
      {
        workspaceId: "ws1",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 0.01,
      },
      {
        ...baseState(),
        allowedProviders: ["anthropic"],
        allowedModels: ["claude-sonnet"],
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(["provider is not on the allowlist", "model is not on the allowlist"]),
    );
  });

  it("fail-closed blocks when store throws", async () => {
    const result = await enforceRequest(
      {
        workspaceId: "ws1",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 0.01,
      },
      {
        loadState: async () => {
          throw new Error("redis down");
        },
        failMode: "closed",
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toContain("fail-closed");
  });

  it("fail-open allows when store throws", async () => {
    const result = await enforceRequest(
      {
        workspaceId: "ws1",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 0.01,
      },
      {
        loadState: async () => {
          throw new Error("redis down");
        },
        failMode: "open",
      },
    );
    expect(result.allowed).toBe(true);
  });

  it("merge combines workspace/project/agent flags", () => {
    const merged = mergeKillSwitchState(
      { workspaceDisabled: false, currentSpendUsd: 1 },
      { projectDisabled: true },
      { agentDisabled: true, maxSteps: 5 },
    );
    expect(merged.projectDisabled).toBe(true);
    expect(merged.agentDisabled).toBe(true);
    expect(merged.maxSteps).toBe(5);
    expect(merged.currentSpendUsd).toBe(1);
  });

  it("redis keys are scoped", () => {
    expect(killSwitchRedisKey("agent", "a1")).toBe("ag:kill:agent:a1");
  });

  it("client cannot clear kill switch by omitting flags — server state wins", () => {
    // Even if a client never sends killSwitchActive, disabled workspace still blocks.
    const result = decideEnforcement(
      {
        workspaceId: "ws1",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 0.01,
      },
      { ...baseState(), workspaceDisabled: true },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("workspace kill switch is active");
  });

  it("race: disabled agent cannot slip through after state update", () => {
    // Simulate two concurrent decides after kill switch flip
    const state = { ...baseState(), agentDisabled: true };
    const a = decideEnforcement(
      {
        workspaceId: "ws",
        agentId: "a",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 0.01,
      },
      state,
    );
    const b = decideEnforcement(
      {
        workspaceId: "ws",
        agentId: "a",
        provider: "openai",
        model: "gpt-4o",
        estimatedCostUsd: 0.01,
      },
      state,
    );
    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(false);
  });
});
