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
  listProviderAccounts: vi.fn(),
  upsertProviderAccount: vi.fn(),
  syncProviderAccount: vi.fn(),
  listGovernanceCapabilityCatalog: vi.fn(),
}));

vi.mock("../db/workspaceSeats", () => ({
  assertSeatAvailable: vi.fn(),
  countReservedSeats: vi.fn(),
  effectiveSeatLimit: vi.fn(),
  getWorkspaceEntitlement: vi.fn(),
}));

import { assertWorkspacePermission } from "../services/workspaceContext";
import { evaluateGatewayGovernance, usageSummary } from "../services/teamGovernance";
import { teamGovernanceRouter } from "./teamGovernance";

describe("teamGovernance auth", () => {
  beforeEach(() => {
    vi.mocked(assertWorkspacePermission).mockReset();
    vi.mocked(evaluateGatewayGovernance).mockClear();
    vi.mocked(usageSummary).mockReset();
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

  it("usageSummary forwards both since and until boundaries", async () => {
    vi.mocked(assertWorkspacePermission).mockResolvedValueOnce("admin");
    vi.mocked(usageSummary).mockResolvedValueOnce({} as never);

    const caller = teamGovernanceRouter.createCaller({
      user: { id: 3 },
      req: { headers: {}, protocol: "https" },
      res: { clearCookie: () => {} },
    } as never);

    await caller.usageSummary({
      workspaceId: 12,
      since: "2026-08-01T00:00:00.000Z",
      until: "2026-08-15T23:59:59.000Z",
    });

    expect(assertWorkspacePermission).toHaveBeenCalledWith(12, 3, "audit", "read");
    expect(usageSummary).toHaveBeenCalledWith(12, {
      since: new Date("2026-08-01T00:00:00.000Z"),
      until: new Date("2026-08-15T23:59:59.000Z"),
    });
  });
});
