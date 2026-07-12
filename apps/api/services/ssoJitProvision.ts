/**
 * Just-In-Time SSO user provisioning (Sprint 6 / Domain 5).
 *
 * When an SSO IdP returns a successful authentication for an identity
 * we've never seen before, we auto-create a local user row keyed off
 * the IdP's stable subject. Existing users are matched by:
 *   1. exact email match (case-insensitive)
 *   2. previously-linked openId of the form `sso:<providerId>:<sub>`
 *
 * We deliberately do NOT auto-elevate existing users to admin via SSO
 * group claims — that would let an IdP misconfiguration grant
 * privileges that should require an in-app workflow. Group claims are
 * surfaced on the user row (`ssoGroups`) so an operator can map them
 * to roles manually if/when they want.
 *
 * Returns the canonical user row whether newly created or pre-existing.
 */

import crypto from "crypto";

import * as db from "../db";

export interface JitIdentity {
  /** Stable identifier from the IdP — `sub` for OIDC, NameID for SAML. */
  subject: string;
  email?: string;
  name?: string;
  groups?: string[];
}

export interface JitOptions {
  providerId: number;
  /**
   * Default role for users whose accounts we create here. Falls back
   * to "viewer" — the safest choice. Caller (the route handler) reads
   * the configured default from the provider row.
   */
  defaultRole?: "admin" | "editor" | "viewer";
}

export interface JitResult {
  user: { id: number; email: string; name: string };
  wasCreated: boolean;
}

function nonNull(value: string | null | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

/**
 * Build the synthetic openId we use for SSO-provisioned accounts. Format
 * `sso:<providerId>:<subject>` so the same physical user from different
 * providers gets distinct rows — we don't want a malicious IdP to claim
 * an account belonging to another IdP's user.
 */
export function ssoOpenId(providerId: number, subject: string): string {
  return `sso:${providerId}:${subject}`;
}

/**
 * Build a deterministic placeholder password hash for SSO-only users.
 * They never log in via password — we still need a hash because the
 * users.passwordHash column is NOT NULL in the schema. We use a hash
 * of strong random bytes that no one (including us) knows the plaintext
 * of, so even if the hash leaks the account can't be password-logged-in.
 */
function placeholderPasswordHash(): string {
  return crypto.createHash("sha256").update(crypto.randomBytes(64)).digest("hex");
}

/**
 * Pure helper: pick the canonical email + name from a JIT identity.
 * Falls back to deterministic defaults so we never create a row with
 * NULL/empty in NOT-NULL columns.
 */
export function resolveDisplayFields(
  identity: JitIdentity,
  providerId: number,
): { email: string; name: string } {
  const email =
    identity.email && identity.email.includes("@")
      ? identity.email.toLowerCase()
      : `${ssoOpenId(providerId, identity.subject)}@sso.local`;
  const name =
    identity.name && identity.name.trim().length > 0
      ? identity.name.trim()
      : (identity.email?.split("@")[0] ?? identity.subject);
  return { email, name };
}

/**
 * Look up an existing user by SSO openId or email; if neither matches,
 * create one. Returns the canonical row. This function is the single
 * call site for SSO-side user creation so audit logging can hook here.
 */
export async function jitProvisionUser(
  identity: JitIdentity,
  opts: JitOptions,
): Promise<JitResult> {
  const { email, name } = resolveDisplayFields(identity, opts.providerId);
  const openId = ssoOpenId(opts.providerId, identity.subject);

  // 1. Did we provision this exact IdP+subject before?
  const existingByOpenId = await db.getUserByOpenId(openId);
  if (existingByOpenId) {
    return {
      user: {
        id: existingByOpenId.id,
        email: nonNull(existingByOpenId.email, email),
        name: nonNull(existingByOpenId.name, name),
      },
      wasCreated: false,
    };
  }

  // 2. Email match for users who already exist via password signup?
  if (identity.email) {
    const existingByEmail = await db.getUserByEmail(email);
    if (existingByEmail) {
      return {
        user: {
          id: existingByEmail.id,
          email: nonNull(existingByEmail.email, email),
          name: nonNull(existingByEmail.name, name),
        },
        wasCreated: false,
      };
    }
  }

  // 3. Create.
  const created = await db.createLocalUser({
    email,
    name,
    passwordHash: placeholderPasswordHash(),
  });
  return {
    user: { id: created.id, email, name },
    wasCreated: true,
  };
}
