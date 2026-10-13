/**
 * Issue #225: workspace authorization after authentication (not authentication).
 *
 * The calling code MUST obtain subjectId from a verified Better Auth/Auth.js
 * server session. Never read it from an HTTP header, request body, query string
 * or unverified JWT claim. This module intentionally exposes no HTTP endpoint.
 * Until a real session integration passes its gates, the Cloudflare login
 * migration guard remains active.
 */
const ROLE_RANK = Object.freeze({ member: 1, admin: 2, owner: 3 });

export class MembershipAccessError extends Error {
  constructor(status, code) {
    super(code);
    this.name = "MembershipAccessError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Requires a previously authenticated subject to be an active workspace
 * member of at least minRole. There is no admin-key, dev, or missing-DB
 * fallback. SQL uses server-derived workspace and subject identifiers.
 */
export async function requireWorkspaceMembership(db, { subjectId, workspaceId, minRole = "member" }) {
  if (!db || typeof db.prepare !== "function") {
    throw new MembershipAccessError(503, "MEMBERSHIP_STORE_UNAVAILABLE");
  }
  if (typeof subjectId !== "string" || subjectId.length < 1 || subjectId.length > 128) {
    throw new MembershipAccessError(401, "VERIFIED_SESSION_REQUIRED");
  }
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) {
    throw new MembershipAccessError(403, "WORKSPACE_ACCESS_DENIED");
  }
  if (!Object.hasOwn(ROLE_RANK, minRole)) {
    throw new MembershipAccessError(403, "WORKSPACE_ACCESS_DENIED");
  }
  let membership;
  try {
    membership = await db
      .prepare(
        `SELECT m.workspace_id, m.subject_id, m.role, m.status, m.revision
           FROM cf_workspace_memberships m
           JOIN cf_workspaces w ON w.id = m.workspace_id
          WHERE m.workspace_id = ? AND m.subject_id = ?`,
      )
      .bind(workspaceId, subjectId)
      .first();
  } catch {
    // Never turn an unavailable membership table or database into access.
    throw new MembershipAccessError(503, "MEMBERSHIP_STORE_UNAVAILABLE");
  }
  if (
    !membership ||
    membership.status !== "active" ||
    !Object.hasOwn(ROLE_RANK, membership.role) ||
    ROLE_RANK[membership.role] < ROLE_RANK[minRole]
  ) {
    throw new MembershipAccessError(403, "WORKSPACE_ACCESS_DENIED");
  }
  return Object.freeze({
    workspaceId: membership.workspace_id,
    subjectId: membership.subject_id,
    role: membership.role,
    revision: membership.revision,
  });
}
