/**
 * Signed approval-callback URLs.
 *
 * Slack / Teams / email alerts carry Approve / Reject actions as plain
 * signed URLs, so a human can resolve a pending approval from the alert
 * itself without a dashboard session. The URL is a bearer capability:
 *   GET /api/approval-callbacks?approvalId=…&decision=approve|reject&exp=…&sig=…
 *
 * Signing follows the codebase's existing scheme — HMAC-SHA256 over a
 * canonical payload with a server secret (same construction as
 * `webhookDelivery.ts`'s outbound signatures and `githubApp.ts`'s
 * verification). No new crypto: the secret is `INTERNAL_SERVICE_SECRET`,
 * already required in production by `_core/env.ts`.
 *
 * Fail-closed: if the secret is empty, `signApprovalCallbackUrl` returns
 * null and `verifyApprovalCallback` rejects everything — alert builders
 * then omit the action buttons/links rather than emitting unsigned ones.
 */

import crypto from "node:crypto";

import { ENV } from "../_core/env";

export type ApprovalCallbackDecision = "approve" | "reject";

export const APPROVAL_CALLBACK_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ApprovalCallbackParams {
  approvalId: string;
  decision: ApprovalCallbackDecision;
  /** Epoch ms after which the link is dead. */
  exp: number;
  /** HMAC-SHA256 hex of the canonical payload. */
  sig: string;
}

function signingSecret(override?: string): string {
  return override ?? ENV.internalServiceSecret ?? "";
}

/** Canonical payload: `approvalId.decision.exp` — mirrors the codebase's HMAC usage. */
function canonicalPayload(p: Omit<ApprovalCallbackParams, "sig">): string {
  return `${p.approvalId}.${p.decision}.${p.exp}`;
}

function hmac(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Sign a callback. Returns null when no server secret is configured —
 * callers must omit the action rather than emit an unsigned link.
 */
export function signApprovalCallback(
  approvalId: string,
  decision: ApprovalCallbackDecision,
  expiresAtMs: number,
  secretOverride?: string,
): string | null {
  const secret = signingSecret(secretOverride);
  if (!secret) return null;
  return hmac(secret, canonicalPayload({ approvalId, decision, exp: expiresAtMs }));
}

/**
 * Build the full callback URL, or null when signing is unavailable
 * (no secret) — nothing stalls: the alert still goes out, minus actions.
 */
export function buildApprovalCallbackUrl(
  baseUrl: string,
  approvalId: string,
  decision: ApprovalCallbackDecision,
  ttlMs: number = APPROVAL_CALLBACK_TTL_MS,
  secretOverride?: string,
): string | null {
  const exp = Date.now() + ttlMs;
  const sig = signApprovalCallback(approvalId, decision, exp, secretOverride);
  if (!sig) return null;
  const q = new URLSearchParams({
    approvalId,
    decision,
    exp: String(exp),
    sig,
  });
  return `${baseUrl.replace(/\/$/, "")}/api/approval-callbacks?${q.toString()}`;
}

export type VerifyFailureReason = "bad_signature" | "expired" | "bad_params" | "not_configured";

export type VerifyResult =
  | { ok: true; approvalId: string; decision: ApprovalCallbackDecision }
  | { ok: false; reason: VerifyFailureReason };

/**
 * Verify query params from an inbound callback hit. Uses timing-safe
 * comparison; rejects expired, malformed, or unsigned params.
 */
export function verifyApprovalCallback(
  params: Record<string, string | undefined>,
  nowMs: number = Date.now(),
  secretOverride?: string,
): VerifyResult {
  const secret = signingSecret(secretOverride);
  if (!secret) return { ok: false, reason: "not_configured" };

  const { approvalId, decision, exp, sig } = params;
  if (!approvalId || (decision !== "approve" && decision !== "reject") || !exp || !sig) {
    return { ok: false, reason: "bad_params" };
  }
  const expMs = Number(exp);
  if (!Number.isFinite(expMs)) return { ok: false, reason: "bad_params" };
  if (expMs <= nowMs) return { ok: false, reason: "expired" };

  const expected = hmac(secret, canonicalPayload({ approvalId, decision, exp: expMs }));
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true, approvalId, decision };
}

/**
 * Sign a resolution receipt (returned by the callback endpoint after a
 * decision is applied). The receipt is HMAC-signed so the requester can
 * prove the decision was recorded; the authoritative evidence remains the
 * hash-chained action ledger row.
 */
export function signReceipt(
  receipt: Record<string, unknown>,
  secretOverride?: string,
): (Record<string, unknown> & { sig: string }) | null {
  const secret = signingSecret(secretOverride);
  if (!secret) return null;
  const body = JSON.stringify(receipt);
  return { ...receipt, sig: hmac(secret, body) };
}
