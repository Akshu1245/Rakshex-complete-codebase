/**
 * Role-Based Access Control (Sprint 6 / Domain 6).
 *
 * Pure permissions logic. No DB, no async — every function here is a
 * deterministic mapping over (role, resource, action). DB lookups for
 * "what role does user X have in workspace Y?" live in
 * server/services/workspaceContext.ts, which calls into here for the
 * actual permission decision.
 *
 * Why keep it pure: testability + cache-friendliness. The result of a
 * permission check is a stable function of the inputs, so we can
 * memoize aggressively at the workspace-context layer without worrying
 * about staleness mid-request.
 */

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export type RbacAction = "read" | "write" | "delete";

/**
 * Scoped resources. Adding a new resource is a one-line change here +
 * one row in PERMISSIONS_MATRIX. Anything currently scoped to userId
 * (collections, policies, alerts, …) should grow a workspaceId column
 * in its table and start consulting `requirePermission` at the router
 * layer.
 */
export type RbacResource =
  | "workspace" // settings, rename, delete
  | "members"
  | "billing"
  | "collections"
  | "policies"
  | "alerts"
  | "webhooks"
  | "sso"
  | "data_export";

/**
 * Numeric rank so we can express "this action requires admin or higher."
 * Higher number = more privilege.
 */
const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

/** The minimum role required for (resource, action). */
const PERMISSIONS_MATRIX: Record<RbacResource, Record<RbacAction, WorkspaceRole>> = {
  workspace: {
    read: "viewer",
    write: "admin",
    delete: "owner",
  },
  members: {
    read: "viewer",
    write: "admin",
    delete: "admin",
  },
  billing: {
    read: "admin",
    write: "owner",
    delete: "owner",
  },
  collections: {
    read: "viewer",
    write: "editor",
    delete: "editor",
  },
  policies: {
    read: "viewer",
    write: "admin",
    delete: "admin",
  },
  alerts: {
    read: "viewer",
    write: "editor",
    delete: "editor",
  },
  webhooks: {
    read: "viewer",
    write: "admin",
    delete: "admin",
  },
  sso: {
    read: "admin",
    write: "admin",
    delete: "owner",
  },
  data_export: {
    read: "viewer",
    write: "editor",
    delete: "admin",
  },
};

/** Returns true iff `role` is at least as privileged as `minRequired`. */
export function roleSatisfies(role: WorkspaceRole, minRequired: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRequired];
}

/** Pure check: can `role` perform `action` on `resource`? */
export function hasPermission(
  role: WorkspaceRole,
  resource: RbacResource,
  action: RbacAction
): boolean {
  const minRequired = PERMISSIONS_MATRIX[resource][action];
  return roleSatisfies(role, minRequired);
}

/** A serialisable summary of what a role can do — feeds the frontend's UI gating. */
export interface PermissionSummary {
  role: WorkspaceRole;
  permissions: Record<RbacResource, Record<RbacAction, boolean>>;
}

export function summarisePermissions(role: WorkspaceRole): PermissionSummary {
  const out: Record<RbacResource, Record<RbacAction, boolean>> = {} as Record<
    RbacResource,
    Record<RbacAction, boolean>
  >;
  for (const resource of Object.keys(PERMISSIONS_MATRIX) as RbacResource[]) {
    out[resource] = {
      read: hasPermission(role, resource, "read"),
      write: hasPermission(role, resource, "write"),
      delete: hasPermission(role, resource, "delete"),
    };
  }
  return { role, permissions: out };
}

/**
 * The least privileged role that can perform (resource, action). Useful
 * for UI: "to do X, you need role Y."
 */
export function minRoleFor(
  resource: RbacResource,
  action: RbacAction
): WorkspaceRole {
  return PERMISSIONS_MATRIX[resource][action];
}

/** Exposed for tests / dashboard. */
export const ALL_ROLES: WorkspaceRole[] = ["owner", "admin", "editor", "viewer"];
export const ALL_RESOURCES: RbacResource[] = Object.keys(
  PERMISSIONS_MATRIX
) as RbacResource[];
export const ALL_ACTIONS: RbacAction[] = ["read", "write", "delete"];

export class PermissionDeniedError extends Error {
  readonly code = "PERMISSION_DENIED" as const;
  readonly resource: RbacResource;
  readonly action: RbacAction;
  readonly required: WorkspaceRole;
  readonly actual: WorkspaceRole;
  constructor(
    resource: RbacResource,
    action: RbacAction,
    actual: WorkspaceRole
  ) {
    const required = minRoleFor(resource, action);
    super(
      `Permission denied: ${action} on ${resource} requires role >= ${required}; you have ${actual}.`
    );
    this.resource = resource;
    this.action = action;
    this.required = required;
    this.actual = actual;
  }
}

/**
 * Throwing wrapper for use in service code. Prefer the pure
 * `hasPermission` in tests; use this in routers / services.
 */
export function assertPermission(
  role: WorkspaceRole,
  resource: RbacResource,
  action: RbacAction
): void {
  if (!hasPermission(role, resource, action)) {
    throw new PermissionDeniedError(resource, action, role);
  }
}
