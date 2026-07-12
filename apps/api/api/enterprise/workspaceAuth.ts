/**
 * Enterprise workspace authorization helpers.
 *
 * Every enterprise procedure must call these before accessing
 * workspace-scoped data. Never trust caller-supplied workspaceId
 * without membership verification.
 */
import { TRPCError } from "@trpc/server";
import { assertWorkspacePermission } from "../../services/workspaceContext";
import type { RbacAction, WorkspaceRole } from "../../services/rbac";
import { PermissionDeniedError } from "../../services/rbac";

/** Enterprise features map to the policies RBAC resource. */
const ENTERPRISE_RESOURCE = "policies" as const;

export async function requireEnterpriseRead(
  workspaceId: number,
  userId: number,
): Promise<WorkspaceRole> {
  return requireEnterpriseAccess(workspaceId, userId, "read");
}

export async function requireEnterpriseWrite(
  workspaceId: number,
  userId: number,
): Promise<WorkspaceRole> {
  return requireEnterpriseAccess(workspaceId, userId, "write");
}

export async function requireEnterpriseAccess(
  workspaceId: number,
  userId: number,
  action: RbacAction,
): Promise<WorkspaceRole> {
  try {
    return await assertWorkspacePermission(workspaceId, userId, ENTERPRISE_RESOURCE, action);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Workspace access denied",
      });
    }
    throw err;
  }
}

/** Verify a resource row belongs to the expected workspace. */
export function assertWorkspaceMatch(recordWorkspaceId: number, expectedWorkspaceId: number): void {
  if (recordWorkspaceId !== expectedWorkspaceId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });
  }
}
