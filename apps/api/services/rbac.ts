/**
 * Role-Based Access Control — market-ready role set.
 *
 * Roles:
 *   owner | admin | security_lead | developer | analyst | viewer | billing_admin
 *
 * Legacy "editor" is accepted as an alias for "developer" at the boundary
 * (see normalizeRole) so existing DB rows keep working.
 */

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "security_lead"
  | "developer"
  | "analyst"
  | "viewer"
  | "billing_admin"
  /** @deprecated use developer */
  | "editor";

export type RbacAction = "read" | "write" | "delete";

export type RbacResource =
  | "workspace"
  | "members"
  | "billing"
  | "collections"
  | "policies"
  | "alerts"
  | "webhooks"
  | "sso"
  | "data_export"
  | "api_keys"
  | "projects"
  | "repositories"
  | "security"
  | "audit";

/**
 * Numeric rank for hierarchy comparisons.
 * Higher = more privilege for general admin actions.
 * Note: billing_admin is high for billing only; matrix below is authoritative.
 */
const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  analyst: 2,
  developer: 3,
  editor: 3, // alias
  billing_admin: 4,
  security_lead: 5,
  admin: 6,
  owner: 7,
};

/** Canonical role after normalizing legacy aliases. */
export function normalizeRole(role: string): WorkspaceRole {
  if (role === "editor") return "developer";
  return role as WorkspaceRole;
}

/**
 * Minimum role required for (resource, action).
 * Roles are checked via roleSatisfies against this minimum.
 */
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
    read: "billing_admin",
    write: "billing_admin",
    delete: "owner",
  },
  collections: {
    read: "viewer",
    write: "developer",
    delete: "developer",
  },
  policies: {
    read: "viewer",
    write: "security_lead",
    delete: "security_lead",
  },
  alerts: {
    read: "viewer",
    write: "developer",
    delete: "developer",
  },
  webhooks: {
    read: "viewer",
    write: "admin",
    delete: "admin",
  },
  sso: {
    read: "security_lead",
    write: "security_lead",
    delete: "owner",
  },
  data_export: {
    read: "analyst",
    write: "analyst",
    delete: "admin",
  },
  api_keys: {
    read: "developer",
    write: "admin",
    delete: "admin",
  },
  projects: {
    read: "viewer",
    write: "developer",
    delete: "admin",
  },
  repositories: {
    read: "viewer",
    write: "developer",
    delete: "admin",
  },
  security: {
    read: "security_lead",
    write: "security_lead",
    delete: "security_lead",
  },
  audit: {
    read: "security_lead",
    write: "admin",
    delete: "owner",
  },
};

/** Special cases that don't fit pure rank (billing_admin, analyst scopes). */
const ROLE_OVERRIDES: Partial<
  Record<WorkspaceRole, Partial<Record<RbacResource, Partial<Record<RbacAction, boolean>>>>>
> = {
  billing_admin: {
    billing: { read: true, write: true, delete: false },
    workspace: { read: true, write: false, delete: false },
    members: { read: true, write: false, delete: false },
    audit: { read: true, write: false, delete: false },
  },
  analyst: {
    collections: { read: true, write: false, delete: false },
    data_export: { read: true, write: true, delete: false },
    projects: { read: true, write: false, delete: false },
    repositories: { read: true, write: false, delete: false },
    alerts: { read: true, write: false, delete: false },
    policies: { read: true, write: false, delete: false },
    audit: { read: true, write: false, delete: false },
  },
  security_lead: {
    security: { read: true, write: true, delete: true },
    policies: { read: true, write: true, delete: true },
    sso: { read: true, write: true, delete: false },
    audit: { read: true, write: false, delete: false },
    api_keys: { read: true, write: true, delete: true },
    members: { read: true, write: false, delete: false },
  },
};

export function roleSatisfies(role: WorkspaceRole, minRequired: WorkspaceRole): boolean {
  const r = normalizeRole(role);
  const m = normalizeRole(minRequired);
  // billing_admin only "satisfies" billing_admin min, not general admin
  if (r === "billing_admin") {
    return m === "billing_admin" || m === "viewer" || m === "analyst";
  }
  return ROLE_RANK[r] >= ROLE_RANK[m];
}

export function hasPermission(
  role: WorkspaceRole,
  resource: RbacResource,
  action: RbacAction,
): boolean {
  const r = normalizeRole(role);
  if (r === "owner") return true;

  const override = ROLE_OVERRIDES[r]?.[resource]?.[action];
  if (typeof override === "boolean") return override;

  // billing_admin: only billing (+ limited reads via overrides)
  if (r === "billing_admin") {
    return resource === "billing" && (action === "read" || action === "write");
  }

  const minRequired = PERMISSIONS_MATRIX[resource][action];
  return roleSatisfies(r, minRequired);
}

export interface PermissionSummary {
  role: WorkspaceRole;
  permissions: Record<RbacResource, Record<RbacAction, boolean>>;
}

export function summarisePermissions(role: WorkspaceRole): PermissionSummary {
  const r = normalizeRole(role);
  const out = {} as Record<RbacResource, Record<RbacAction, boolean>>;
  for (const resource of Object.keys(PERMISSIONS_MATRIX) as RbacResource[]) {
    out[resource] = {
      read: hasPermission(r, resource, "read"),
      write: hasPermission(r, resource, "write"),
      delete: hasPermission(r, resource, "delete"),
    };
  }
  return { role: r, permissions: out };
}

export function minRoleFor(resource: RbacResource, action: RbacAction): WorkspaceRole {
  return PERMISSIONS_MATRIX[resource][action];
}

export const ALL_ROLES: WorkspaceRole[] = [
  "owner",
  "admin",
  "security_lead",
  "developer",
  "analyst",
  "viewer",
  "billing_admin",
];

/** Roles that can be assigned via invitation (not owner). */
export const ASSIGNABLE_ROLES = [
  "admin",
  "security_lead",
  "developer",
  "analyst",
  "viewer",
  "billing_admin",
] as const;

export const ALL_RESOURCES: RbacResource[] = Object.keys(PERMISSIONS_MATRIX) as RbacResource[];
export const ALL_ACTIONS: RbacAction[] = ["read", "write", "delete"];

export class PermissionDeniedError extends Error {
  readonly code = "PERMISSION_DENIED" as const;
  readonly resource: RbacResource;
  readonly action: RbacAction;
  readonly required: WorkspaceRole;
  readonly actual: WorkspaceRole;
  constructor(resource: RbacResource, action: RbacAction, actual: WorkspaceRole) {
    const required = minRoleFor(resource, action);
    super(
      `Permission denied: ${action} on ${resource} requires role >= ${required}; you have ${actual}.`,
    );
    this.resource = resource;
    this.action = action;
    this.required = required;
    this.actual = normalizeRole(actual);
  }
}

export function assertPermission(
  role: WorkspaceRole,
  resource: RbacResource,
  action: RbacAction,
): void {
  if (!hasPermission(role, resource, action)) {
    throw new PermissionDeniedError(resource, action, role);
  }
}
