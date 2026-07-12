/**
 * Part C gate: tenant isolation automated tests.
 *
 * These prove that authorization helpers never treat workspace A membership
 * as access to workspace B resources — pure RBAC + ownership checks.
 */

import { describe, expect, it } from "vitest";
import { hasPermission, type WorkspaceRole } from "./rbac";

/** Minimal stand-in for row ownership used across routers. */
export interface TenantScopedRow {
  workspaceId: string;
  id: string;
}

export function assertSameWorkspace(actorWorkspaceId: string, resource: TenantScopedRow): boolean {
  return actorWorkspaceId === resource.workspaceId;
}

export function canAccessResource(params: {
  actorWorkspaceId: string;
  actorRole: WorkspaceRole;
  resource: TenantScopedRow;
  action: "read" | "write" | "delete";
  resourceType: "collections" | "policies" | "billing" | "members" | "data_export" | "alerts";
}): boolean {
  if (!assertSameWorkspace(params.actorWorkspaceId, params.resource)) {
    return false;
  }
  return hasPermission(params.actorRole, params.resourceType, params.action);
}

/** API-key scope check: key is bound to a single workspace. */
export function apiKeyCanAccessWorkspace(
  keyWorkspaceId: string,
  targetWorkspaceId: string,
): boolean {
  return keyWorkspaceId === targetWorkspaceId;
}

describe("tenant isolation", () => {
  const rowA: TenantScopedRow = { workspaceId: "ws_a", id: "col_1" };
  const rowB: TenantScopedRow = { workspaceId: "ws_b", id: "col_1" };

  it("denies cross-workspace read even for owners", () => {
    expect(
      canAccessResource({
        actorWorkspaceId: "ws_a",
        actorRole: "owner",
        resource: rowB,
        action: "read",
        resourceType: "collections",
      }),
    ).toBe(false);
  });

  it("allows same-workspace owner delete", () => {
    expect(
      canAccessResource({
        actorWorkspaceId: "ws_a",
        actorRole: "owner",
        resource: rowA,
        action: "delete",
        resourceType: "collections",
      }),
    ).toBe(true);
  });

  it("viewer cannot write policies in own workspace", () => {
    expect(
      canAccessResource({
        actorWorkspaceId: "ws_a",
        actorRole: "viewer",
        resource: { workspaceId: "ws_a", id: "pol_1" },
        action: "write",
        resourceType: "policies",
      }),
    ).toBe(false);
  });

  it("admin cannot access other workspace billing", () => {
    expect(
      canAccessResource({
        actorWorkspaceId: "ws_a",
        actorRole: "admin",
        resource: { workspaceId: "ws_b", id: "bill_1" },
        action: "read",
        resourceType: "billing",
      }),
    ).toBe(false);
  });

  it("API keys cannot cross workspaces", () => {
    expect(apiKeyCanAccessWorkspace("ws_a", "ws_b")).toBe(false);
    expect(apiKeyCanAccessWorkspace("ws_a", "ws_a")).toBe(true);
  });

  it("enumerates isolation matrix for collections", () => {
    const roles: WorkspaceRole[] = ["owner", "admin", "editor", "viewer"];
    for (const role of roles) {
      // Same workspace reads always ok for all roles
      expect(
        canAccessResource({
          actorWorkspaceId: "ws_a",
          actorRole: role,
          resource: rowA,
          action: "read",
          resourceType: "collections",
        }),
      ).toBe(true);
      // Cross-workspace always denied
      expect(
        canAccessResource({
          actorWorkspaceId: "ws_a",
          actorRole: role,
          resource: rowB,
          action: "read",
          resourceType: "collections",
        }),
      ).toBe(false);
    }
  });
});
