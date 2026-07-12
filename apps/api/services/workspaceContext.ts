/**
 * Workspace context + per-request role resolution (Sprint 6 / Domain 6).
 *
 * Given (userId, workspaceId), returns the user's active membership row
 * — or null if they aren't a member. Used by `assertWorkspacePermission`
 * to gate every workspace-scoped tRPC procedure.
 *
 * Caching: results are memoised in-process with a 60-second TTL keyed by
 * `<workspaceId>:<userId>`. Production deployments wanting cross-pod
 * cache coherence can drop a Redis-backed implementation behind the
 * same interface. We deliberately keep the cache short-lived so role
 * revocations propagate within a minute.
 */

import crypto from "crypto";

import * as db from "../db";
import type { WorkspaceRow } from "@rakshex/database";
import {
  type RbacAction,
  type RbacResource,
  type WorkspaceRole,
  assertPermission,
  hasPermission,
  normalizeRole,
} from "./rbac";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { role: WorkspaceRole; expiresAt: number }>();

function cacheKey(workspaceId: number, userId: number): string {
  return `${workspaceId}:${userId}`;
}

/** Drop the cached membership for a user — call after role changes. */
export function invalidateMembershipCache(workspaceId: number, userId: number): void {
  cache.delete(cacheKey(workspaceId, userId));
}

/** Drop every cached entry — used by tests + workspace deletion. */
export function clearMembershipCache(): void {
  cache.clear();
}

/**
 * Returns the active role the user holds in the workspace, or null
 * if not a member / inactive. Cached for CACHE_TTL_MS.
 */
export async function getWorkspaceRole(
  workspaceId: number,
  userId: number,
): Promise<WorkspaceRole | null> {
  const key = cacheKey(workspaceId, userId);
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }
  const member = await db.getWorkspaceMembership(workspaceId, userId);
  if (!member || !member.active) {
    return null;
  }
  const role = normalizeRole(member.role as string);
  cache.set(key, { role, expiresAt: now + CACHE_TTL_MS });
  return role;
}

/**
 * The single function every workspace-scoped router should call before
 * doing real work. Throws PermissionDeniedError on failure, returns
 * the caller's role on success so the caller can branch on owner-only
 * UI details if needed.
 */
export async function assertWorkspacePermission(
  workspaceId: number,
  userId: number,
  resource: RbacResource,
  action: RbacAction,
): Promise<WorkspaceRole> {
  const role = await getWorkspaceRole(workspaceId, userId);
  if (!role) {
    // We treat "not a member" the same as "no permission" rather than
    // leaking workspace existence to non-members.
    throw new (await import("./rbac")).PermissionDeniedError(resource, action, "viewer");
  }
  assertPermission(role, resource, action);
  return role;
}

/**
 * Non-throwing variant for read-time UI gating. Returns
 * { allowed, role } so a router can both render and authorise.
 */
export async function checkWorkspacePermission(
  workspaceId: number,
  userId: number,
  resource: RbacResource,
  action: RbacAction,
): Promise<{ allowed: boolean; role: WorkspaceRole | null }> {
  const role = await getWorkspaceRole(workspaceId, userId);
  if (!role) return { allowed: false, role: null };
  return { allowed: hasPermission(role, resource, action), role };
}

/**
 * Idempotently make sure a user has a personal workspace and is its
 * owner. Called on signup and lazily on first request from existing
 * users. Returns the canonical personal-workspace row.
 *
 * Slug generation is "user-<id>" by default; collisions are vanishingly
 * rare since id is unique, but we still salt with random hex if the
 * slug is somehow taken (race / backfill).
 */
export async function ensurePersonalWorkspace(
  userId: number,
  displayName: string | null,
): Promise<WorkspaceRow> {
  const existing = await db.getPersonalWorkspaceForUser(userId);
  if (existing) return existing;
  const base = `user-${userId}`;
  let slug = base;
  if (await db.getWorkspaceBySlug(slug)) {
    slug = `${base}-${crypto.randomBytes(3).toString("hex")}`;
  }
  const id = await db.createWorkspace({
    slug,
    name: (displayName && displayName.trim()) || `User ${userId}`,
    ownerUserId: userId,
    isPersonal: true,
  });
  await db.addWorkspaceMember({
    workspaceId: id,
    userId,
    role: "owner",
    active: true,
    joinedAt: new Date(),
  });
  invalidateMembershipCache(id, userId);
  const row = await db.getWorkspaceById(id);
  if (!row) {
    throw new Error("failed to create personal workspace");
  }
  return row;
}
