/**
 * Cross-tenant negative tests for collection/finding access helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("../db", () => ({
  getCollectionById: vi.fn(),
  getFindingById: vi.fn(),
  setCollectionWorkspaceId: vi.fn(),
  setFindingWorkspaceId: vi.fn(),
}));

vi.mock("./workspaceContext", () => ({
  ensurePersonalWorkspace: vi.fn(),
}));

vi.mock("./authorization", () => ({
  assertWorkspacePermission: vi.fn(),
}));

import * as db from "../db";
import { ensurePersonalWorkspace } from "./workspaceContext";
import { assertWorkspacePermission } from "./authorization";
import { requireCollectionAccess, requireFindingAccess } from "./tenantAccess";

describe("tenantAccess cross-tenant isolation", () => {
  beforeEach(() => {
    vi.mocked(db.getCollectionById).mockReset();
    vi.mocked(db.getFindingById).mockReset();
    vi.mocked(db.setCollectionWorkspaceId).mockReset();
    vi.mocked(db.setFindingWorkspaceId).mockReset();
    vi.mocked(ensurePersonalWorkspace).mockReset();
    vi.mocked(assertWorkspacePermission).mockReset();
  });

  it("user A cannot read user B collection (different workspace)", async () => {
    vi.mocked(db.getCollectionById).mockResolvedValue({
      id: "col_b",
      userId: 2,
      workspaceId: 20,
      name: "B",
    } as any);
    vi.mocked(assertWorkspacePermission).mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" }),
    );

    await expect(requireCollectionAccess("col_b", 1, "collections", "read")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(assertWorkspacePermission).toHaveBeenCalledWith(20, 1, "collections", "read");
  });

  it("user A cannot access user B finding", async () => {
    vi.mocked(db.getFindingById).mockResolvedValue({
      id: "f_b",
      userId: 2,
      workspaceId: 20,
      collectionId: "col_b",
    } as any);
    vi.mocked(assertWorkspacePermission).mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" }),
    );

    await expect(requireFindingAccess("f_b", 1, "read")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("legacy null workspaceId denies non-owners without leaking", async () => {
    vi.mocked(db.getCollectionById).mockResolvedValue({
      id: "col_legacy",
      userId: 2,
      workspaceId: null,
      name: "Legacy",
    } as any);

    await expect(
      requireCollectionAccess("col_legacy", 1, "collections", "read"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(assertWorkspacePermission).not.toHaveBeenCalled();
  });

  it("owner of legacy row backfills workspace and asserts permission", async () => {
    vi.mocked(db.getCollectionById).mockResolvedValue({
      id: "col_legacy",
      userId: 1,
      workspaceId: null,
      name: "Mine",
    } as any);
    vi.mocked(ensurePersonalWorkspace).mockResolvedValue({ id: 7 } as any);
    vi.mocked(assertWorkspacePermission).mockResolvedValue("owner");

    const result = await requireCollectionAccess("col_legacy", 1, "collections", "read");
    expect(result.workspaceId).toBe(7);
    expect(db.setCollectionWorkspaceId).toHaveBeenCalledWith("col_legacy", 7);
    expect(assertWorkspacePermission).toHaveBeenCalledWith(7, 1, "collections", "read");
  });
});
