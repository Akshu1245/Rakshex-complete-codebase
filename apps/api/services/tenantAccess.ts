/**
 * Helpers for resolving the caller's workspace and asserting access
 * to tenant-scoped resources (collections, scans, findings).
 */
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { ensurePersonalWorkspace } from "./workspaceContext";
import { assertWorkspacePermission } from "./authorization";
import type { RbacAction, RbacResource } from "./rbac";

export async function resolveCallerWorkspace(
  userId: number,
  displayName: string | null | undefined,
) {
  return ensurePersonalWorkspace(userId, displayName ?? null);
}

/**
 * Resolve a collection and assert the caller may act on its workspace.
 * Legacy rows with null workspaceId fall back to owner userId check, then
 * backfill workspaceId from the caller's personal workspace when they own it.
 */
export async function requireCollectionAccess(
  collectionId: string,
  userId: number,
  resource: RbacResource,
  action: RbacAction,
  displayName?: string | null,
) {
  const collection = await db.getCollectionById(collectionId);
  if (!collection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Collection not found or access denied",
    });
  }

  let workspaceId = collection.workspaceId ?? null;

  if (workspaceId == null) {
    // Legacy userId-only row: only the owner may access, then backfill.
    if (collection.userId !== userId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collection not found or access denied",
      });
    }
    const ws = await resolveCallerWorkspace(userId, displayName);
    workspaceId = ws.id;
    await db.setCollectionWorkspaceId(collectionId, workspaceId);
  }

  await assertWorkspacePermission(workspaceId, userId, resource, action);
  return { collection: { ...collection, workspaceId }, workspaceId };
}

/**
 * Assert finding access via workspace (preferred) or legacy userId ownership.
 */
export async function requireFindingAccess(
  findingId: string,
  userId: number,
  action: RbacAction = "read",
) {
  const row = await db.getFindingById(findingId);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
  }

  let workspaceId = (row as { workspaceId?: number | null }).workspaceId ?? null;

  if (workspaceId == null) {
    if ((row as { userId?: number }).userId !== userId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
    }
    const collection = await db.getCollectionById(row.collectionId);
    workspaceId = collection?.workspaceId ?? null;
    if (workspaceId == null) {
      const ws = await resolveCallerWorkspace(userId, null);
      workspaceId = ws.id;
    }
    await db.setFindingWorkspaceId(findingId, workspaceId);
  }

  // Findings inherit the collections permission matrix (viewer read / developer write).
  await assertWorkspacePermission(workspaceId, userId, "collections", action);
  return { finding: row, workspaceId };
}
