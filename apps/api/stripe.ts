/**
 * Stripe billing rail (Sprint 2 scaffolding).
 *
 * USD invoicing via Stripe sits alongside the existing INR rail (Razorpay).
 * Region-detect at checkout selects the appropriate provider. The Razorpay
 * code path is unchanged — this module is invoked only when
 * `ENV.stripeEnabled` is true and the buyer's region selects USD.
 *
 * MVP scope: Stripe Checkout Session creation + webhook verification +
 * subscription lifecycle event handling (created, updated, deleted, invoice
 * paid/failed). Tax handling, dunning, and proration upgrades are roadmap
 * (Sprint 3).
 *
 * We do NOT pull in the official `stripe` SDK yet — keeping this module
 * dependency-free until live keys are configured avoids adding a 1.5MB
 * runtime dependency to every dev environment. When the SDK is required,
 * swap `fetchWithTimeout`-based calls below for `new Stripe(...)`.
 */
import crypto from "crypto";
import { ENV } from "./_core/env";
import { BillingProviderError, InternalError } from "./_core/errors";
import { logger } from "./_core/logger";
import { fetchWithTimeout } from "./utils/fetchWithTimeout";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = 8_000;

// Bumping to avoid silent breakage when Stripe pushes minor changes.
const STRIPE_API_VERSION = "2024-09-30.acacia";

interface CheckoutSessionInput {
  /** Buyer's billing email. */
  email: string;
  /** Stripe Price ID (e.g. `price_pro_99usd_monthly`). */
  priceId: string;
  /** Where to send the user after payment. */
  successUrl: string;
  cancelUrl: string;
  /** Optional metadata stored on the session and copied to the subscription. */
  metadata?: Record<string, string>;
}

interface StripeCheckoutSession {
  id: string;
  url: string | null;
  status: string;
}

/**
 * Create a Stripe Checkout Session for a subscription. Returns the hosted
 * URL the dashboard redirects the user to.
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<StripeCheckoutSession> {
  if (!ENV.stripeEnabled) {
    throw new InternalError("Stripe is not enabled in this deployment");
  }

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("customer_email", input.email);
  form.set("success_url", input.successUrl);
  form.set("cancel_url", input.cancelUrl);
  form.set("line_items[0][price]", input.priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("automatic_tax[enabled]", "true");
  if (input.metadata) {
    for (const [k, v] of Object.entries(input.metadata)) {
      form.set(`metadata[${k}]`, v);
      form.set(`subscription_data[metadata][${k}]`, v);
    }
  }

  let resp: Response;
  try {
    resp = await fetchWithTimeout(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.stripeSecretKey}`,
        "Stripe-Version": STRIPE_API_VERSION,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      timeoutMs: STRIPE_TIMEOUT_MS,
    });
  } catch (err) {
    logger.error({ err }, "[Stripe] checkout session network error");
    throw new BillingProviderError("Stripe unreachable");
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    logger.warn(
      { status: resp.status, body: body.slice(0, 500) },
      "[Stripe] checkout session error",
    );
    throw new BillingProviderError(`Stripe checkout creation failed (${resp.status})`);
  }

  const json = (await resp.json()) as StripeCheckoutSession;
  return json;
}

/**
 * Verify a Stripe webhook signature.
 *
 * Stripe signs each event with `Stripe-Signature: t=<timestamp>,v1=<sha256>`.
 * We compute `HMAC-SHA256(timestamp.body, webhookSecret)` and compare in
 * constant time.
 *
 * Tolerance: reject events older than 5 minutes to defeat replay attacks.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string,
  toleranceSeconds = 300,
  secretOverride?: string,
): { valid: boolean; reason?: string } {
  // Allow callers (notably tests) to inject the secret rather than relying
  // on ENV being captured at module-load time.
  const secret = secretOverride ?? ENV.stripeWebhookSecret;
  if (!secret) {
    return { valid: false, reason: "no_webhook_secret" };
  }
  if (!signatureHeader) {
    return { valid: false, reason: "no_signature_header" };
  }

  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp = "";
  const v1Sigs: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t" && v) timestamp = v;
    if (k === "v1" && v) v1Sigs.push(v);
  }
  if (!timestamp || v1Sigs.length === 0) {
    return { valid: false, reason: "malformed_signature" };
  }

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { valid: false, reason: "bad_timestamp" };
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSeconds > toleranceSeconds) {
    return { valid: false, reason: "stale_event" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const matches = v1Sigs.some((s) => {
    if (s.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
  });

  return matches ? { valid: true } : { valid: false, reason: "no_match" };
}

interface StripeSubscriptionLite {
  id: string;
  status: string;
  customer: string;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string } }> };
}

interface StripeEvent {
  id: string;
  type: string;
  data?: { object?: unknown };
}

/**
 * Map a verified Stripe event to a normalised lifecycle action.
 *
 * Returns `null` when the event type is one we don't act on yet (we still
 * persist it via `processedWebhookEvents` to keep idempotency clean).
 */
export interface StripeBillingAction {
  kind:
    | "subscription_active"
    | "subscription_past_due"
    | "subscription_canceled"
    | "invoice_paid"
    | "invoice_failed";
  subscriptionId: string;
  customerId: string;
  priceId?: string;
  metadata?: Record<string, string>;
}

export function mapStripeEvent(event: StripeEvent): StripeBillingAction | null {
  const obj = event.data?.object;
  if (!obj || typeof obj !== "object") return null;
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = obj as StripeSubscriptionLite;
      const priceId = sub.items?.data?.[0]?.price?.id;
      if (sub.status === "active" || sub.status === "trialing") {
        return {
          kind: "subscription_active",
          subscriptionId: sub.id,
          customerId: sub.customer,
          ...(priceId !== undefined ? { priceId } : {}),
          ...(sub.metadata !== undefined ? { metadata: sub.metadata } : {}),
        };
      }
      if (sub.status === "past_due" || sub.status === "unpaid") {
        return {
          kind: "subscription_past_due",
          subscriptionId: sub.id,
          customerId: sub.customer,
          ...(priceId !== undefined ? { priceId } : {}),
          ...(sub.metadata !== undefined ? { metadata: sub.metadata } : {}),
        };
      }
      if (sub.status === "canceled" || sub.status === "incomplete_expired") {
        return {
          kind: "subscription_canceled",
          subscriptionId: sub.id,
          customerId: sub.customer,
          ...(priceId !== undefined ? { priceId } : {}),
          ...(sub.metadata !== undefined ? { metadata: sub.metadata } : {}),
        };
      }
      return null;
    }
    case "customer.subscription.deleted": {
      const sub = obj as StripeSubscriptionLite;
      return {
        kind: "subscription_canceled",
        subscriptionId: sub.id,
        customerId: sub.customer,
        ...(sub.metadata !== undefined ? { metadata: sub.metadata } : {}),
      };
    }
    case "invoice.payment_succeeded": {
      const inv = obj as {
        id?: string;
        subscription?: string;
        customer?: string;
      };
      if (!inv.subscription || !inv.customer) return null;
      return {
        kind: "invoice_paid",
        subscriptionId: inv.subscription,
        customerId: inv.customer,
      };
    }
    case "invoice.payment_failed": {
      const inv = obj as {
        id?: string;
        subscription?: string;
        customer?: string;
      };
      if (!inv.subscription || !inv.customer) return null;
      return {
        kind: "invoice_failed",
        subscriptionId: inv.subscription,
        customerId: inv.customer,
      };
    }
    default:
      return null;
  }
}
