/**
 * Billing webhook events — signed, retried outbound events for billing sinks.
 *
 * Salvaged from DevPulse `_core/webhookService.ts` (Team D, 2026-09-25).
 * Provider-neutral: the event payload carries workspace/plan/usage facts and
 * an HMAC-SHA256 signature so ANY sink (Razorpay, Paddle, an internal
 * collector) can verify origin. Team A connects the provider checkout and
 * entitlement wiring — this file only delivers the event reliably.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface BillingWebhookEvent {
  /** e.g. "usage.threshold_exceeded", "billing.cycle_closed". */
  type: string;
  workspaceId: string;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface BillingWebhookDispatchResult {
  ok: boolean;
  attempts: number;
  lastStatus?: number;
  lastError?: string;
}

const SIGNATURE_HEADER = "x-rakshex-signature";
const EVENT_HEADER = "x-rakshex-event";
const TIMESTAMP_HEADER = "x-rakshex-timestamp";
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 8_000;

/** Deterministic signature payload: `${timestamp}.${eventType}.${body}`. */
export function billingWebhookSignature(input: {
  secret: string;
  timestamp: string;
  eventType: string;
  body: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.eventType}.${input.body}`)
    .digest("hex");
}

/** Verify an inbound signature (for the sink side / tests). */
export function verifyBillingWebhookSignature(input: {
  secret: string;
  timestamp: string;
  eventType: string;
  body: string;
  signatureHex: string;
}): boolean {
  const expected = billingWebhookSignature(input);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signatureHex, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deliver one billing event with exponential-backoff retries on network
 * errors and 5xx/429 responses. 4xx (other than 429) is terminal.
 */
export async function dispatchBillingWebhook(input: {
  url: string;
  secret: string;
  event: BillingWebhookEvent;
  maxAttempts?: number;
  timeoutMs?: number;
}): Promise<BillingWebhookDispatchResult> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const body = JSON.stringify(input.event);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = billingWebhookSignature({
    secret: input.secret,
    timestamp,
    eventType: input.event.type,
    body,
  });

  let attempts = 0;
  let lastStatus: number | undefined;
  let lastError: string | undefined;

  for (attempts = 1; attempts <= maxAttempts; attempts++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [SIGNATURE_HEADER]: `sha256=${signature}`,
          [EVENT_HEADER]: input.event.type,
          [TIMESTAMP_HEADER]: timestamp,
        },
        body,
        signal: controller.signal,
      });
      lastStatus = res.status;
      if (res.ok) {
        return { ok: true, attempts, lastStatus };
      }
      if (res.status !== 429 && res.status < 500) {
        return { ok: false, attempts, lastStatus, lastError: `terminal status ${res.status}` };
      }
      lastError = `retryable status ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
    if (attempts < maxAttempts) {
      await sleep(1000 * 2 ** (attempts - 1)); // 1s, 2s, 4s …
    }
  }
  return { ok: false, attempts, lastStatus, lastError };
}
