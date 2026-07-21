/**
 * Central authorization middleware helpers.
 *
 * Never trust client-supplied roles or workspace membership claims —
 * always resolve role from the database via workspaceContext.
 */
import { TRPCError } from "@trpc/server";
import type { WorkspaceRole, RbacResource, RbacAction } from "./rbac";
import { assertPermission, hasPermission, normalizeRole, PermissionDeniedError } from "./rbac";
import { getWorkspaceRole } from "./workspaceContext";

export type AuthUser = { id: number; role?: string };

/**
 * Resolve membership role from DB. Throws 403 if not a member.
 * Ignores any client-supplied role.
 */
export async function requireWorkspaceMembership(
  workspaceId: number,
  userId: number,
): Promise<WorkspaceRole> {
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid workspace id" });
  }
  const role = await getWorkspaceRole(workspaceId, userId);
  if (!role) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a member of this workspace",
    });
  }
  return normalizeRole(role);
}

/**
 * Assert workspace membership + RBAC permission. Throws 403 on denial.
 */
export async function requireWorkspacePermission(
  workspaceId: number,
  userId: number,
  resource: RbacResource,
  action: RbacAction,
): Promise<WorkspaceRole> {
  const role = await requireWorkspaceMembership(workspaceId, userId);
  try {
    assertPermission(role, resource, action);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: err.message,
      });
    }
    throw err;
  }
  return role;
}

/**
 * Alias used by market-ready routers — same semantics as requireWorkspacePermission
 * (DB-resolved membership + RBAC, TRPCError on denial). Prefer this name at call sites
 * that historically imported assertWorkspacePermission from workspaceContext.
 */
export const assertWorkspacePermission = requireWorkspacePermission;

/**
 * Soft check — returns false instead of throwing.
 */
export async function checkWorkspacePermission(
  workspaceId: number,
  userId: number,
  resource: RbacResource,
  action: RbacAction,
): Promise<boolean> {
  const role = await getWorkspaceRole(workspaceId, userId);
  if (!role) return false;
  return hasPermission(normalizeRole(role), resource, action);
}

/**
 * Cross-tenant guard: ensure a resource's workspaceId matches the caller's
 * authorized workspace. Never accept a client-supplied workspace override
 * that differs from the resource row.
 */
export function assertSameWorkspace(
  resourceWorkspaceId: number | null | undefined,
  authorizedWorkspaceId: number,
): void {
  if (
    resourceWorkspaceId == null ||
    Number(resourceWorkspaceId) !== Number(authorizedWorkspaceId)
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cross-tenant access denied",
    });
  }
}

/**
 * Require authenticated user (401).
 */
export function requireUser(user: AuthUser | null | undefined): AuthUser {
  if (!user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }
  return user;
}
