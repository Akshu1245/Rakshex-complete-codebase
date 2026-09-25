/**
 * Paddle (global merchant-of-record) webhook processor.
 *
 * Integration-ready, not live: signature verification follows Paddle's
 * documented scheme (`Paddle-Signature: ts=…;h1=…`, HMAC-SHA256 over
 * "ts:rawBody"), claim-first idempotency reuses the shared
 * processedWebhookEvents table, and entitlements flow through the same
 * `applyPlanEntitlement` path as Razorpay.
 *
 * Goes live when: PADDLE_WEBHOOK_SECRET is set, a Paddle webhook endpoint is
 * registered in the Paddle dashboard, and checkout passes
 * `custom_data: { workspace_id, user_id, plan }`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import * as db from "../../db";
import { ENV } from "../../_core/env";
import { logger } from "../../_core/logger";
import { applyPlanEntitlement, normalizeBillablePlan, type BillablePlan } from "./entitlements";

const MAX_SKEW_SECONDS = 300;

export interface PaddleWebhookPayload {
  event_id?: string;
  event_type?: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string;
    custom_data?: Record<string, string | number | null | undefined> | null;
  };
}

export type PaddleProcessResult =
  | { status: "disabled" }
  | { status: "bad_payload" }
  | { status: "invalid_signature" }
  | { status: "duplicate"; eventId: string }
  | { status: "ignored"; eventType: string }
  | { status: "missing_user"; eventId: string }
  | { status: "ok"; eventId: string; eventType: string };

export function parsePaddleSignature(header: string): { ts: string; h1: string } | null {
  let ts = "";
  let h1 = "";
  for (const part of header.split(";")) {
    const p = part.trim();
    if (p.startsWith("ts=")) ts = p.slice(3);
    else if (p.startsWith("h1=")) h1 = p.slice(3);
  }
  if (!ts || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/i.test(h1)) return null;
  return { ts, h1: h1.toLowerCase() };
}

/**
 * Verify Paddle's webhook signature. Pure — unit tested.
 * Rejects missing/malformed signatures and timestamps older than 5 minutes.
 */
export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const parsed = parsePaddleSignature(signatureHeader);
  if (!parsed) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - parseInt(parsed.ts, 10));
  if (skew > MAX_SKEW_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${parsed.ts}:${rawBody}`, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parsed.h1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

interface NormalizedPaddleEvent {
  eventType: string;
  plan: BillablePlan;
  status: string;
}

const ENTITLEMENT_EVENTS = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.canceled",
]);

/** Map a Paddle event to an entitlement change. Pure — unit tested. */
export function normalizePaddleEvent(payload: PaddleWebhookPayload): NormalizedPaddleEvent | null {
  const eventType = payload.event_type;
  if (!eventType || !ENTITLEMENT_EVENTS.has(eventType)) return null;
  const custom = payload.data?.custom_data ?? {};
  const plan = normalizeBillablePlan(custom["plan"]);
  if (eventType === "subscription.canceled") {
    return { eventType, plan: "free", status: "canceled" };
  }
  const subStatus = String(payload.data?.status ?? "").toLowerCase();
  return {
    eventType,
    plan,
    status: subStatus === "past_due" ? "past_due" : "active",
  };
}

function customStr(custom: Record<string, string | number | null | undefined> | null | undefined, key: string): string {
  const v = custom?.[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export async function processPaddleWebhook(opts: {
  rawBody: string;
  signatureHeader: string;
}): Promise<PaddleProcessResult> {
  const secret = ENV.paddleWebhookSecret;
  if (!secret) {
    logger.warn("[Billing] Paddle webhook received but PADDLE_WEBHOOK_SECRET is not set — ignoring");
    return { status: "disabled" };
  }

  let payload: PaddleWebhookPayload;
  try {
    payload = JSON.parse(opts.rawBody) as PaddleWebhookPayload;
  } catch {
    return { status: "bad_payload" };
  }

  if (!verifyPaddleSignature(opts.rawBody, opts.signatureHeader, secret)) {
    logger.warn("[Billing] Paddle webhook signature verification failed");
    return { status: "invalid_signature" };
  }

  const eventId = payload.event_id;
  if (!eventId) return { status: "bad_payload" };

  // Claim-first idempotency: the durable insert is the lock; concurrent
  // retries lose the race and skip side effects.
  const claimed = await db.markWebhookEventProcessed("paddle", eventId, payload.event_type ?? "unknown");
  if (!claimed) return { status: "duplicate", eventId };

  const normalized = normalizePaddleEvent(payload);
  if (!normalized) return { status: "ignored", eventType: payload.event_type ?? "unknown" };

  const custom = payload.data?.custom_data;
  const userId = parseInt(customStr(custom, "user_id"), 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    logger.warn({ eventId }, "[Billing] Paddle webhook missing custom_data.user_id — cannot entitle");
    return { status: "missing_user", eventId };
  }

  try {
    await applyPlanEntitlement({
      userId,
      plan: normalized.plan,
      status: normalized.status,
      workspaceId: customStr(custom, "workspace_id") || null,
      billingProvider: "paddle",
      billingCustomerId: payload.data?.customer_id ?? null,
      billingSubscriptionId: payload.data?.id ?? null,
    });
  } catch (err) {
    // Release the claim so Paddle's retry can re-run side effects.
    await db.releaseWebhookEventClaim("paddle", eventId);
    throw err;
  }

  return { status: "ok", eventId, eventType: normalized.eventType };
}
