/**
 * Signed human approval bound to (a) an AUTHENTICATED workspace owner/admin and
 * (b) the exact patch, impact and checks content. A receipt is "verified" only after
 * BOTH the Ed25519 signature AND a recomputation of every bound hash succeed.
 */
import { createPrivateKey, createPublicKey, randomUUID, sign, verify, type KeyObject } from "node:crypto";
import { canonical, digest, sha256 } from "./canonical.js";
import type { CheckRecord } from "./checks.js";
import { checksDigest } from "./checks.js";
import type { Impact } from "./types.js";

export type Role = "owner" | "admin" | "member" | "viewer";
/** Produced by the server's auth layer (session / OIDC). NEVER parsed from a request body. */
export interface Principal { userId: string; workspaceId: string; role: Role; authenticated: true }
export interface Authenticator { current(): Promise<Principal | null> }

export type Decision = "APPROVED" | "REFUSED";
export interface ApprovalPayload {
  v: 1; decision: Decision; reason?: string;
  workspaceId: string; approver: { userId: string; role: Role };
  repo: string; baseSha: string; siteIds: string[];
  patchSha256: string; impactSha256: string; checksSha256: string;
  checksSummary: { passed: number; failed: number; notRun: number };
  issuedAt: string; expiresAt: string; nonce: string;
}
export interface Receipt { payload: ApprovalPayload; keyId: string; signature: string }
export interface Bound { repo: string; baseSha: string; workspaceId: string; patchDiff: string; impacts: Impact[]; checks: CheckRecord[]; siteIds: string[] }

const APPROVER_ROLES: Role[] = ["owner", "admin"];
export const impactDigest = (impacts: Impact[]) =>
  digest([...impacts].map((i) => ({ c: i.change, s: i.site, v: i.verdict, p: i.evidence.payloadStatus })).sort((a, b) => canonical(a).localeCompare(canonical(b))));

export class ApprovalError extends Error {}

export async function issueReceipt(
  auth: Authenticator, decision: Decision, b: Bound,
  key: { keyId: string; privateKeyPem: string }, opts: { ttlMs?: number; now?: Date; reason?: string } = {},
): Promise<Receipt> {
  const who = await auth.current();
  if (!who || who.authenticated !== true) throw new ApprovalError("not authenticated");
  if (who.workspaceId !== b.workspaceId) throw new ApprovalError("principal is not a member of this workspace");
  if (!APPROVER_ROLES.includes(who.role)) throw new ApprovalError(`role ${who.role} may not approve or refuse repairs`);
  if (decision === "APPROVED" && b.checks.some((c) => c.status === "failed")) throw new ApprovalError("cannot approve: a check failed");
  const now = opts.now ?? new Date();
  const payload: ApprovalPayload = {
    v: 1, decision, reason: opts.reason, workspaceId: b.workspaceId, approver: { userId: who.userId, role: who.role },
    repo: b.repo, baseSha: b.baseSha, siteIds: [...b.siteIds].sort(),
    patchSha256: sha256(b.patchDiff), impactSha256: impactDigest(b.impacts), checksSha256: checksDigest(b.checks),
    checksSummary: { passed: b.checks.filter((c) => c.status === "passed").length, failed: b.checks.filter((c) => c.status === "failed").length, notRun: b.checks.filter((c) => c.status === "not_run").length },
    issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + (opts.ttlMs ?? 24 * 3600_000)).toISOString(), nonce: randomUUID(),
  };
  const sig = sign(null, Buffer.from(canonical(payload)), createPrivateKey(key.privateKeyPem));
  return { payload, keyId: key.keyId, signature: sig.toString("base64") };
}

export interface Verification { verified: boolean; signatureValid: boolean; contentValid: boolean; problems: string[]; decision?: Decision }

export function verifyReceipt(
  r: Receipt, b: Bound, keys: Record<string, string | KeyObject>, opts: { now?: Date; seenNonces?: Set<string> } = {},
): Verification {
  const problems: string[] = [];
  const pub = keys[r?.keyId];
  let signatureValid = false;
  try {
    signatureValid = !!pub && verify(null, Buffer.from(canonical(r.payload)), typeof pub === "string" ? createPublicKey(pub) : pub, Buffer.from(r.signature, "base64"));
  } catch { signatureValid = false; }
  if (!pub) problems.push(`unknown keyId ${r?.keyId}`);
  else if (!signatureValid) problems.push("signature invalid");
  const p = r?.payload;
  if (p) {
    const chk = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
    chk(p.v === 1, "unsupported receipt version");
    chk(APPROVER_ROLES.includes(p.approver?.role), "approver role is not owner/admin");
    chk(p.workspaceId === b.workspaceId, "workspace mismatch");
    chk(p.repo === b.repo, "repo mismatch");
    chk(p.baseSha === b.baseSha, "base commit mismatch");
    chk(canonical(p.siteIds) === canonical([...b.siteIds].sort()), "site set mismatch");
    chk(p.patchSha256 === sha256(b.patchDiff), "patch hash mismatch (patch changed after approval)");
    chk(p.impactSha256 === impactDigest(b.impacts), "impact hash mismatch");
    chk(p.checksSha256 === checksDigest(b.checks), "checks hash mismatch (checks re-run or edited)");
    const now = (opts.now ?? new Date()).getTime();
    chk(now <= Date.parse(p.expiresAt) && now >= Date.parse(p.issuedAt) - 5 * 60_000, "receipt expired or not yet valid");
    if (opts.seenNonces) { chk(!opts.seenNonces.has(p.nonce), "nonce replayed"); }
    if (p.decision === "APPROVED") chk(!b.checks.some((c) => c.status === "failed"), "a check failed");
  } else problems.push("missing payload");
  const contentValid = !!p && problems.filter((x) => !x.startsWith("signature") && !x.startsWith("unknown keyId")).length === 0;
  const verified = signatureValid && contentValid;
  if (verified && opts.seenNonces) opts.seenNonces.add(p.nonce);
  return { verified, signatureValid, contentValid, problems, decision: verified ? p.decision : undefined };
}
