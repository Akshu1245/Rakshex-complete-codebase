/**
 * Webhook delivery service.
 *
 * Fires lifecycle events to user-registered HTTP endpoints. Generalises the
 * hard-coded Slack integration in server/slack.ts so any customer with an
 * internal alerting stack (PagerDuty, Opsgenie, Teams, a custom SIEM) can
 * react to DevPulse events without us having to build a bespoke integration.
 *
 * Signature scheme (compatible with Razorpay/Stripe/GitHub conventions):
 *   Header:  X-DevPulse-Signature-256: sha256=<hex-hmac-sha256(body)>
 *   Body:    JSON document with { id, event, createdAt, data }
 *
 * Receivers verify by computing HMAC-SHA256 of the raw body with their
 * endpoint's secret and constant-time comparing to the header value.
 *
 * Delivery is fire-and-forget from the caller's perspective; all results
 * (success or failure) are persisted to webhook_deliveries for audit/retry.
 */

import crypto from "crypto";
import https from "https";
import http from "http";
import { nanoid } from "nanoid";
import * as db from "../db";
import type { WebhookEndpoint } from "../../drizzle/schema";
import { logger } from "../_core/logger";

const SSRF_BLOCKED_HOSTS = [
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "localhost",
  "169.254.169.254",
  "metadata.google.internal",
];
const SSRF_BLOCKED_CIDRS = [
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^127\.\d+\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.\d+\.\d+\.\d+$/,
  /^fc00:/,
  /^fe80:/,
  /^::1$/,
  /^::$/,
];

function validateWebhookUrl(rawUrl: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "Invalid URL format";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "Only http and https URLs are allowed";
  }
  const hostname = parsed.hostname.toLowerCase();
  if (SSRF_BLOCKED_HOSTS.includes(hostname)) {
    return `Host ${hostname} is blocked`;
  }
  for (const cidr of SSRF_BLOCKED_CIDRS) {
    if (cidr.test(hostname)) {
      return `Host ${hostname} is blocked (internal network)`;
    }
  }
  return undefined;
}

/**
 * Module-scoped HTTP(S) agents with keep-alive enabled. Reusing TCP + TLS
 * sessions across deliveries is the single biggest speed win here — saves
 * ~50–150ms per delivery on the TLS handshake alone, which matters when a
 * scan fires dozens of finding.discovered webhooks in quick succession.
 */
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 32,
  maxFreeSockets: 8,
});
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 32,
  maxFreeSockets: 8,
});

export type WebhookEvent =
  | "scan.complete"
  | "scan.started"
  | "finding.discovered"
  | "quota.warning"
  | "kill_switch.triggered"
  | "subscription.updated";

export interface WebhookPayload {
  id: string; // Unique delivery id, stable across retries
  event: WebhookEvent;
  createdAt: string; // ISO8601
  data: Record<string, unknown>;
}

/**
 * Auto-disable threshold — after this many consecutive failures we flip
 * the endpoint to inactive so we don't keep hammering a dead receiver.
 */
const AUTO_DISABLE_AFTER_FAILURES = 20;
const DELIVERY_TIMEOUT_MS = 5_000;

function sign(body: string, secret: string): string {
  return (
    "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex")
  );
}

/**
 * Constant-time comparison helper exposed so webhook receivers (or our own
 * tests) can verify a delivery without accidentally introducing a timing
 * side channel. Returns false if lengths differ (which is safe because
 * timingSafeEqual throws on length mismatch).
 */
export function verifySignature(
  body: string,
  signatureHeader: string,
  secret: string
): boolean {
  const expected = sign(body, secret);
  if (expected.length !== signatureHeader.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}

/**
 * Delivery result per-endpoint. Returned for tests/admin UI; most callers
 * should just await `deliver()` and ignore the return value.
 */
export interface DeliveryResult {
  endpointId: string;
  deliveryId: string;
  status: "delivered" | "failed";
  httpStatus?: number;
  error?: string;
}

/**
 * Primary entry. Looks up the active endpoints for `userId` subscribed to
 * `event`, posts the payload, and records an audit row for each attempt.
 *
 * Never throws — webhook delivery failures must not take down the primary
 * request. Errors are logged and persisted.
 */
export async function deliver(
  userId: number,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<DeliveryResult[]> {
  let endpoints: WebhookEndpoint[] = [];
  try {
    endpoints = await db.getActiveWebhookEndpoints(userId, event);
  } catch (err) {
    logger.warn({ err: err }, "[webhookDelivery] failed to list endpoints");
    return [];
  }

  if (endpoints.length === 0) return [];

  const payload: WebhookPayload = {
    id: nanoid(),
    event,
    createdAt: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);

  const results = await Promise.all(
    endpoints.map(ep => deliverToEndpoint(ep, payload, body))
  );
  return results;
}

async function deliverToEndpoint(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
  body: string
): Promise<DeliveryResult> {
  const deliveryId = nanoid();
  const signature = sign(body, endpoint.secret);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let httpStatus: number | undefined;
  let responseBody = "";
  let errorMessage: string | undefined;

  const urlError = validateWebhookUrl(endpoint.url);
  if (urlError) {
    errorMessage = `SSRF blocked: ${urlError}`;
    logger.warn({ endpointId: endpoint.id, url: endpoint.url, reason: urlError }, "[webhookDelivery] SSRF blocked");
  } else {
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "user-agent": "DevPulse-Webhook/1.0",
          "x-devpulse-event": payload.event,
          "x-devpulse-delivery-id": payload.id,
          "x-devpulse-signature-256": signature,
        },
        body,
        // @ts-expect-error: Node's undici fetch accepts a dispatcher/agent at
        // runtime but the DOM-ish fetch types omit it.
        agent: endpoint.url.startsWith("https:") ? httpsAgent : httpAgent,
      });
      httpStatus = res.status;
      responseBody = (await res.text()).slice(0, 8192);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }

  const ok = httpStatus !== undefined && httpStatus >= 200 && httpStatus < 300;

  // Persist audit + update endpoint stats (best-effort — don't break the
  // fire-and-forget contract).
  try {
    await db.createWebhookDelivery({
      id: deliveryId,
      webhookId: endpoint.id,
      event: payload.event,
      payload: payload as unknown as Record<string, unknown>,
      status: httpStatus ?? null,
      responseBody: responseBody || null,
      errorMessage: errorMessage ?? null,
      deliveredAt: ok ? new Date() : null,
    });

    if (ok) {
      await db.recordWebhookSuccess(endpoint.id, httpStatus!);
    } else {
      const nextFailures = (endpoint.consecutiveFailures ?? 0) + 1;
      await db.recordWebhookFailure(
        endpoint.id,
        httpStatus ?? null,
        nextFailures >= AUTO_DISABLE_AFTER_FAILURES
      );
    }
  } catch (err) {
    logger.warn({ err: err }, "[webhookDelivery] failed to persist audit row");
  }

  return {
    endpointId: endpoint.id,
    deliveryId,
    status: ok ? "delivered" : "failed",
    httpStatus,
    error: errorMessage,
  };
}

/**
 * Exposed for test endpoints and dashboard "send test event" buttons.
 */
export function buildSignature(body: string, secret: string): string {
  return sign(body, secret);
}
