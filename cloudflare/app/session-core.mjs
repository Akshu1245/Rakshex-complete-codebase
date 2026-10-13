/**
 * P1 / PR #233: internal opaque session storage for the future supported
 * Better Auth/Auth.js identity adapter. THIS MODULE DOES NOT AUTHENTICATE USERS.
 *
 * Only a verified server-side sign-in handler may call createSession or
 * rotateSession; never expose their inputs directly from a public request.
 * No HTTP entrypoints are wired and APP_AUTH_NOT_MIGRATED remains enabled.
 *
 * Never enable session cookie caching. Every request must consult D1 so
 * revocation and membership changes take effect on the next request.
 */
const COOKIE_NAME = "__Host-rakshex_session";
const TOKEN_RE = /^rkh_s_[A-Za-z0-9_-]{43}$/;
const MAX_AGE_SECONDS = 8 * 60 * 60;

export class SessionError extends Error {
  constructor(status, code) {
    super(code);
    this.name = "SessionError";
    this.status = status;
    this.code = code;
  }
}

function requireStore(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new SessionError(503, "SESSION_STORE_UNAVAILABLE");
  }
}

function requireVerifiedIdentity(identity) {
  if (
    !identity ||
    identity.verifiedByAuthAdapter !== true ||
    typeof identity.subjectId !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(identity.subjectId) ||
    !Number.isSafeInteger(identity.workspaceId) ||
    identity.workspaceId <= 0
  ) {
    throw new SessionError(401, "VERIFIED_IDENTITY_REQUIRED");
  }
  return identity;
}

async function hashToken(token) {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return "rkh_s_" + base64;
}

function nowSeconds(clock) {
  const value = clock instanceof Date ? clock.getTime() : Date.now();
  if (!Number.isFinite(value)) throw new SessionError(503, "CLOCK_UNAVAILABLE");
  return Math.floor(value / 1000);
}

function validBearer(token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    throw new SessionError(401, "SESSION_INVALID");
  }
  return token;
}

export function sessionCookie(token) {
  validBearer(token);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Reject duplicate session cookies to prevent ambiguity across proxies. */
export function readSessionCookie(header) {
  if (typeof header !== "string" || header.length > 8192) {
    throw new SessionError(401, "SESSION_INVALID");
  }
  const matches = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(COOKIE_NAME + "="));
  if (matches.length !== 1) throw new SessionError(401, "SESSION_INVALID");
  return validBearer(matches[0].slice(COOKIE_NAME.length + 1));
}

async function currentMembership(db, identity) {
  try {
    return await db
      .prepare(
        `SELECT revision FROM cf_workspace_memberships
          WHERE workspace_id=? AND subject_id=? AND status='active'`,
      )
      .bind(identity.workspaceId, identity.subjectId)
      .first();
  } catch {
    throw new SessionError(503, "SESSION_STORE_UNAVAILABLE");
  }
}

/** Internal only. verifiedByAuthAdapter is an integration sentinel, not proof
 * by itself: the caller MUST verify credentials with Auth.js/Better Auth first.
 */
export async function createSession(db, identity, clock = new Date()) {
  requireStore(db);
  requireVerifiedIdentity(identity);
  const membership = await currentMembership(db, identity);
  if (!membership) throw new SessionError(403, "MEMBERSHIP_REQUIRED");
  const token = newToken();
  const hash = await hashToken(token);
  const created = nowSeconds(clock);
  try {
    await db
      .prepare(
        `INSERT INTO cf_browser_sessions
         (token_hash,workspace_id,subject_id,membership_revision,created_at,expires_at)
         VALUES (?,?,?,?,?,?)`,
      )
      .bind(
        hash,
        identity.workspaceId,
        identity.subjectId,
        membership.revision,
        String(created),
        String(created + MAX_AGE_SECONDS),
      )
      .run();
  } catch {
    throw new SessionError(503, "SESSION_STORE_UNAVAILABLE");
  }
  return Object.freeze({ token, setCookie: sessionCookie(token) });
}

export async function verifySession(db, token, clock = new Date()) {
  requireStore(db);
  validBearer(token);
  const hash = await hashToken(token);
  let row;
  try {
    row = await db
      .prepare(
        `SELECT s.workspace_id,s.subject_id,s.membership_revision,s.expires_at,
                s.revoked_at,m.revision AS current_revision,m.status AS member_status,
                m.role AS member_role
           FROM cf_browser_sessions s
           JOIN cf_workspace_memberships m
             ON m.workspace_id=s.workspace_id AND m.subject_id=s.subject_id
          WHERE s.token_hash=?`,
      )
      .bind(hash)
      .first();
  } catch {
    throw new SessionError(503, "SESSION_STORE_UNAVAILABLE");
  }
  if (
    !row ||
    row.revoked_at !== null ||
    row.member_status !== "active" ||
    row.membership_revision !== row.current_revision ||
    Number(row.expires_at) <= nowSeconds(clock)
  ) {
    throw new SessionError(401, "SESSION_INVALID");
  }
  return Object.freeze({
    subjectId: row.subject_id,
    workspaceId: row.workspace_id,
    role: row.member_role,
    membershipRevision: row.current_revision,
  });
}

/** Atomic token revocation. A subsequent call to verifySession must fail. */
export async function revokeSession(db, token, clock = new Date()) {
  requireStore(db);
  validBearer(token);
  const hash = await hashToken(token);
  try {
    const result = await db
      .prepare(
        `UPDATE cf_browser_sessions SET revoked_at=?
         WHERE token_hash=? AND revoked_at IS NULL`,
      )
      .bind(String(nowSeconds(clock)), hash)
      .run();
    return result.meta.changes === 1;
  } catch {
    throw new SessionError(503, "SESSION_STORE_UNAVAILABLE");
  }
}

/** Use only after reauthentication / permission change by the auth adapter.
 * A changed membership revision immediately invalidates the old token.
 * This function forces revocation before reissue; a failed reissue is deny-only.
 */
export async function rotateSession(db, oldToken, verifiedIdentity, clock = new Date()) {
  requireStore(db);
  requireVerifiedIdentity(verifiedIdentity);
  validBearer(oldToken);
  const hash = await hashToken(oldToken);
  let old;
  try {
    old = await db
      .prepare(
        `UPDATE cf_browser_sessions
            SET revoked_at=?
          WHERE token_hash=? AND workspace_id=? AND subject_id=?
            AND revoked_at IS NULL AND expires_at>?
          RETURNING subject_id`,
      )
      .bind(
        String(nowSeconds(clock)),
        hash,
        verifiedIdentity.workspaceId,
        verifiedIdentity.subjectId,
        String(nowSeconds(clock)),
      )
      .first();
  } catch {
    throw new SessionError(503, "SESSION_STORE_UNAVAILABLE");
  }
  if (!old) throw new SessionError(401, "SESSION_INVALID");
  return createSession(db, verifiedIdentity, clock);
}
