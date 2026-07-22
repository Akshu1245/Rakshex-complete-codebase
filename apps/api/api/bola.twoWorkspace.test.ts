/**
 * Two-workspace BOLA coverage for findings and report creation.
 * Proves a caller in workspace A cannot read workspace B resources even when
 * they know the foreign IDs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { generateCsrfToken } from "../utils/security";

const mocks = vi.hoisted(() => ({
  requireFindingAccess: vi.fn(),
  requireCollectionAccess: vi.fn(),
  getFindingById: vi.fn(),
  getScanById: vi.fn(),
  getFindingsByScanId: vi.fn(),
  getDb: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("../services/tenantAccess", () => ({
  requireFindingAccess: mocks.requireFindingAccess,
  requireCollectionAccess: mocks.requireCollectionAccess,
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
  getFindingById: mocks.getFindingById,
  getScanById: mocks.getScanById,
  getFindingsByScanId: mocks.getFindingsByScanId,
  reactivateExpiredSuppressions: vi.fn(),
  listFindingsForUser: vi.fn(),
  updateOnboardingStep: vi.fn(),
}));

import { findingsRouter } from "./findings";
import { reportsRouter } from "./reports";

function context(userId: number) {
  const csrfToken = generateCsrfToken();
  return {
    user: { id: userId, name: `user-${userId}` },
    req: {
      headers: {
        cookie: `csrf-token=${csrfToken}`,
        "x-csrf-token": csrfToken,
      },
      protocol: "https",
      ip: "203.0.113.10",
    },
    res: { clearCookie: () => undefined },
  } as never;
}

describe("two-workspace BOLA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({
      insert: () => ({ values: mocks.insertValues }),
    });
    mocks.insertValues.mockResolvedValue(undefined);
  });

  it("denies workspace A caller reading a workspace B finding", async () => {
    mocks.requireFindingAccess.mockRejectedValue(
      new TRPCError({ code: "NOT_FOUND", message: "Finding not found" }),
    );
    const caller = findingsRouter.createCaller(context(1));

    await expect(caller.get({ id: "finding-from-workspace-b" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.requireFindingAccess).toHaveBeenCalledWith("finding-from-workspace-b", 1, "read");
  });

  it("denies workspace A caller creating a report from workspace B scan", async () => {
    mocks.getScanById.mockResolvedValue({
      id: "scan-b",
      collectionId: "collection-b",
      status: "completed",
    });
    mocks.requireCollectionAccess.mockRejectedValue(
      new TRPCError({
        code: "NOT_FOUND",
        message: "Collection not found or access denied",
      }),
    );

    const caller = reportsRouter.createCaller(context(1));
    await expect(caller.create({ scanId: "scan-b", expiresInDays: 7 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.requireCollectionAccess).toHaveBeenCalledWith(
      "collection-b",
      1,
      "collections",
      "read",
      "user-1",
    );
  });
});
