import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionDeniedError } from "../services/rbac";

vi.mock("../services/workspaceContext", () => ({
  assertWorkspacePermission: vi.fn(),
}));

vi.mock("../services/teamGovernance", () => ({
  evaluateGatewayGovernance: vi.fn().mockResolvedValue({ allowed: true }),
  governanceSummary: vi.fn(),
  listIdentities: vi.fn(),
  linkIdentityToMember: vi.fn(),
  usageSummary: vi.fn(),
  listBudgets: vi.fn(),
  upsertBudget: vi.fn(),
  deleteBudget: vi.fn(),
  listKillSwitches: vi.fn(),
  setKillSwitch: vi.fn(),
  syncProvider: vi.fn(),
  listProviderAccounts: vi.fn(),
  upsertProviderAccount: vi.fn(),
  syncProviderAccount: vi.fn(),
  listGovernanceCapabilityCatalog: vi.fn(),
}));

vi.mock("../db", () => ({
  createAuditLogEntry: vi.fn(),
}));

vi.mock("../db/workspaceSeats", () => ({
  assertSeatAvailable: vi.fn(),
  countReservedSeats: vi.fn(),
  effectiveSeatLimit: vi.fn(),
  getWorkspaceEntitlement: vi.fn(),
}));

import { assertWorkspacePermission } from "../services/workspaceContext";
import {
  evaluateGatewayGovernance,
  setKillSwitch,
  syncProvider,
  upsertBudget,
} from "../services/teamGovernance";
import { createAuditLogEntry } from "../db";
import { teamGovernanceRouter } from "./teamGovernance";

describe("teamGovernance auth", () => {
  beforeEach(() => {
    vi.mocked(assertWorkspacePermission).mockReset();
    vi.mocked(evaluateGatewayGovernance).mockClear();
    vi.mocked(upsertBudget).mockReset();
    vi.mocked(setKillSwitch).mockReset();
    vi.mocked(syncProvider).mockReset();
    vi.mocked(createAuditLogEntry).mockReset();
  });

  it("evaluateGateway denies non-members with FORBIDDEN before service call", async () => {
    vi.mocked(assertWorkspacePermission).mockRejectedValueOnce(
      new PermissionDeniedError("policies", "read", "viewer"),
    );

    const caller = teamGovernanceRouter.createCaller({
      user: { id: 99 },
      req: { headers: {}, protocol: "https" },
      res: { clearCookie: () => {} },
    } as never);

    await expect(
      caller.evaluateGateway({ workspaceId: 7, estimatedCostUsd: 0 }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Workspace access denied",
    });

    expect(evaluateGatewayGovernance).not.toHaveBeenCalled();
  });

  it("evaluateGateway requires policies:read for the requested workspace", async () => {
    vi.mocked(assertWorkspacePermission).mockResolvedValueOnce("admin");
    vi.mocked(evaluateGatewayGovernance).mockResolvedValueOnce({
      allowed: true,
    } as never);

    const caller = teamGovernanceRouter.createCaller({
      user: { id: 3 },
      req: { headers: {}, protocol: "https" },
      res: { clearCookie: () => {} },
    } as never);

    await caller.evaluateGateway({
      workspaceId: 12,
      identityId: 5,
      estimatedCostUsd: 0.02,
    });

    expect(assertWorkspacePermission).toHaveBeenCalledWith(12, 3, "policies", "read");
    expect(evaluateGatewayGovernance).toHaveBeenCalledWith({
      workspaceId: 12,
      identityId: 5,
      projectId: undefined,
      agentId: undefined,
      estimatedCostUsd: 0.02,
    });
  });

  it("records workspace scoped evidence when a hard routed budget is configured", async () => {
    vi.mocked(assertWorkspacePermission).mockResolvedValueOnce("admin");
    vi.mocked(upsertBudget).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(createAuditLogEntry).mockResolvedValueOnce(undefined);
    const caller = teamGovernanceRouter.createCaller({
      user: { id: 3, role: "editor" },
      req: { headers: { "x-api-key": "test-key" }, protocol: "https" },
      res: { clearCookie: () => {} },
    } as never);

    await caller.setBudget({
      workspaceId: 12,
      limitUsd: 100,
      warningPct: 80,
      hardLimit: true,
      enforcementMode: "gateway",
    });

    expect(createAuditLogEntry).toHaveBeenCalledWith(
      3,
      "team_governance_budget_set",
      expect.objectContaining({
        workspaceId: 12,
        budgetId: 42,
        hardLimit: true,
        enforcementMode: "gateway",
      }),
    );
  });

  it("records a scoped stop change and provider synchronization without provider secret values", async () => {
    vi.mocked(assertWorkspacePermission).mockResolvedValue("admin");
    vi.mocked(setKillSwitch).mockResolvedValueOnce({ id: 51 } as never);
    vi.mocked(syncProvider).mockResolvedValueOnce({
      status: "success",
      seatsSynced: 2,
      usageEventsSynced: 4,
    } as never);
    vi.mocked(createAuditLogEntry).mockResolvedValue(undefined);
    const caller = teamGovernanceRouter.createCaller({
      user: { id: 3, role: "editor" },
      req: { headers: { "x-api-key": "test-key" }, protocol: "https" },
      res: { clearCookie: () => {} },
    } as never);

    await caller.setKillSwitch({
      workspaceId: 12,
      scopeType: "workspace",
      scopeId: "12",
      active: true,
      reason: "incident",
    });
    await caller.syncProvider({ workspaceId: 12, provider: "openai", providerAccountId: 7 });

    expect(createAuditLogEntry).toHaveBeenNthCalledWith(
      1,
      3,
      "team_governance_kill_switch_set",
      expect.objectContaining({ workspaceId: 12, killSwitchId: 51, active: true }),
    );
    expect(createAuditLogEntry).toHaveBeenNthCalledWith(
      2,
      3,
      "provider_sync_completed",
      expect.objectContaining({
        workspaceId: 12,
        provider: "openai",
        providerAccountId: 7,
        status: "success",
        seatsSynced: 2,
        usageEventsSynced: 4,
      }),
    );
    expect(JSON.stringify(vi.mocked(createAuditLogEntry).mock.calls)).not.toMatch(
      /sk-|api[_-]?key|bearer/i,
    );
  });
});
