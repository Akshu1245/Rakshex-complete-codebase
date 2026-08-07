import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken } from "../utils/security";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getScanById: vi.fn(),
  getFindingsByScanId: vi.fn(),
  requireCollectionAccess: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
  getScanById: mocks.getScanById,
  getFindingsByScanId: mocks.getFindingsByScanId,
}));

vi.mock("../services/tenantAccess", () => ({
  requireCollectionAccess: mocks.requireCollectionAccess,
}));

import { reportsRouter } from "./reports";
import { publicReportsRouter } from "./publicReports";

function context(user: { id: number; name: string } | null) {
  const csrfToken = generateCsrfToken();
  return {
    user,
    req: {
      headers: {
        cookie: `csrf-token=${csrfToken}`,
        "x-csrf-token": csrfToken,
      },
      protocol: "https",
    },
    res: { clearCookie: () => undefined },
  } as never;
}

describe("shareable reports authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({
      insert: () => ({ values: mocks.insertValues }),
    });
    mocks.getScanById.mockResolvedValue({
      id: "scan-1",
      collectionId: "collection-1",
      status: "completed",
    });
    mocks.requireCollectionAccess.mockResolvedValue({
      workspaceId: 42,
      collection: { id: "collection-1", name: "Payments API" },
    });
    mocks.getFindingsByScanId.mockResolvedValue([
      {
        title: "Missing authentication",
        severity: "High",
        endpoint: "/payments",
        description: "Endpoint accepts unauthenticated requests",
        remediation: "Require authorization",
      },
    ]);
    mocks.insertValues.mockResolvedValue(undefined);
  });

  it("requires authentication to create a report", async () => {
    const caller = reportsRouter.createCaller(context(null));
    await expect(caller.create({ scanId: "scan-1", expiresInDays: 30 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("derives report contents and tenant from authorized scan data", async () => {
    const caller = reportsRouter.createCaller(context({ id: 7, name: "Asha" }));
    const result = await caller.create({ scanId: "scan-1", expiresInDays: 7 });

    expect(mocks.requireCollectionAccess).toHaveBeenCalledWith(
      "collection-1",
      7,
      "collections",
      "read",
      "Asha",
    );
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: 7,
        workspaceId: 42,
        scanId: "scan-1",
        score: 85,
        filename: "Payments API",
        findings: [
          expect.objectContaining({
            title: "Missing authentication",
            severity: "High",
          }),
        ],
      }),
    );
    expect(result.reportId).toHaveLength(24);
  });

  it("does not expose raw scan IDs through the preview endpoint", async () => {
    const caller = publicReportsRouter.createCaller(context(null));
    await expect(caller.getByScanId({ scanId: "scan-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
