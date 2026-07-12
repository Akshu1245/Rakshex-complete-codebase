/**
 * Billing provider abstraction.
 * Frontend never assigns plans — only webhook/server-side entitlement updates do.
 */

export type PlanId = "free" | "trial" | "pro" | "enterprise";
export type BillingInterval = "month" | "year";
export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "paused";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  seatsIncluded: number;
  monthlyPriceCents: number;
  annualPriceCents: number;
  usageLimit: number;
  overagePerUnitCents: number;
  trialDays?: number;
}

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    seatsIncluded: 1,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    usageLimit: 100,
    overagePerUnitCents: 0,
  },
  trial: {
    id: "trial",
    name: "Trial",
    seatsIncluded: 3,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    usageLimit: 1000,
    overagePerUnitCents: 0,
    trialDays: 14,
  },
  pro: {
    id: "pro",
    name: "Pro",
    seatsIncluded: 10,
    monthlyPriceCents: 4900,
    annualPriceCents: 47000,
    usageLimit: 10_000,
    overagePerUnitCents: 1,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    seatsIncluded: 100,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    usageLimit: 250_000,
    overagePerUnitCents: 0,
  },
};

export interface CheckoutSessionInput {
  workspaceId: string;
  customerEmail: string;
  planId: Exclude<PlanId, "free">;
  interval: BillingInterval;
  seats?: number;
  couponCode?: string;
  successUrl: string;
  cancelUrl: string;
  /** GST / tax ID for invoice */
  taxId?: string;
  country?: string;
}

export interface CheckoutSessionResult {
  provider: "stripe" | "razorpay";
  sessionId: string;
  url: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  rawBody: string;
  signature: string;
  provider: "stripe" | "razorpay";
}

export interface WebhookProcessResult {
  ok: boolean;
  duplicate?: boolean;
  entitlementPlan?: PlanId;
  status?: SubscriptionStatus;
  message?: string;
}

export interface BillingProvider {
  readonly name: "stripe" | "razorpay";
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  cancelSubscription(subscriptionId: string, immediately: boolean): Promise<{ status: string }>;
  verifyWebhook(event: WebhookEvent, secret: string): boolean;
  processWebhook(event: WebhookEvent, seenIds: Set<string>): Promise<WebhookProcessResult>;
}

/** In-memory Stripe-like provider for tests and local dev. */
export class MemoryBillingProvider implements BillingProvider {
  readonly name = "stripe" as const;
  private processed = new Set<string>();

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const plan = PLAN_CATALOG[input.planId];
    if (!plan || (plan.monthlyPriceCents === 0 && plan.id !== "trial")) {
      throw new Error("Invalid plan for checkout");
    }
    // Server-side plan assignment only
    return {
      provider: "stripe",
      sessionId: `cs_test_${input.workspaceId}_${input.planId}`,
      url: input.successUrl,
    };
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean,
  ): Promise<{ status: string }> {
    return { status: immediately ? "canceled" : "active" };
  }

  verifyWebhook(event: WebhookEvent, secret: string): boolean {
    if (!secret) return false;
    // Constant-time-ish compare of HMAC-style signature in tests
    return event.signature === `sig_${secret}_${event.rawBody.length}`;
  }

  async processWebhook(
    event: WebhookEvent,
    seenIds: Set<string> = this.processed,
  ): Promise<WebhookProcessResult> {
    if (seenIds.has(event.id)) {
      return { ok: true, duplicate: true, message: "idempotent replay" };
    }
    seenIds.add(event.id);

    if (event.type === "invoice.payment_failed" || event.type === "payment.failed") {
      return {
        ok: true,
        entitlementPlan: "free",
        status: "past_due",
        message: "failed payment — grace/dunning applied",
      };
    }
    if (event.type === "customer.subscription.updated" || event.type === "subscription.activated") {
      return { ok: true, entitlementPlan: "pro", status: "active" };
    }
    if (event.type === "customer.subscription.deleted") {
      return { ok: true, entitlementPlan: "free", status: "canceled" };
    }
    return { ok: true, message: "ignored event type" };
  }
}

/**
 * Apply entitlement only from verified webhook results — never from client input.
 */
export function applyEntitlementFromWebhook(
  result: WebhookProcessResult,
  currentPlan: PlanId,
): PlanId {
  if (result.duplicate) return currentPlan;
  if (result.entitlementPlan) return result.entitlementPlan;
  return currentPlan;
}

export function computeOverageCents(planId: PlanId, usage: number): number {
  const plan = PLAN_CATALOG[planId];
  if (usage <= plan.usageLimit) return 0;
  return (usage - plan.usageLimit) * plan.overagePerUnitCents;
}

export function applyCoupon(
  amountCents: number,
  coupon?: { percentOff?: number; amountOffCents?: number },
): number {
  if (!coupon) return amountCents;
  if (coupon.percentOff) {
    return Math.max(0, Math.round(amountCents * (1 - coupon.percentOff / 100)));
  }
  if (coupon.amountOffCents) {
    return Math.max(0, amountCents - coupon.amountOffCents);
  }
  return amountCents;
}

/** GST-style tax on invoice subtotal (India default 18%). */
export function applyTax(
  subtotalCents: number,
  opts: { rate?: number; country?: string } = {},
): { taxCents: number; totalCents: number; rate: number } {
  const rate = opts.rate ?? (opts.country === "IN" ? 0.18 : 0);
  const taxCents = Math.round(subtotalCents * rate);
  return { taxCents, totalCents: subtotalCents + taxCents, rate };
}
