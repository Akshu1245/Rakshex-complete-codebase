import crypto from "crypto";
import { ENV } from "./_core/env";
import { BillingProviderError, InternalError } from "./_core/errors";
import { logger } from "./_core/logger";
import { fetchWithTimeout } from "./utils/fetchWithTimeout";

// Razorpay's API responds in <500ms under normal conditions, but plan-list
// queries against a customer with thousands of plans can briefly stall.
// Cap every outbound call at 8s so a flaky upstream can never pin a
// request thread indefinitely.
const RAZORPAY_TIMEOUT_MS = 8_000;

// ============================================================================
// RAZORPAY SUBSCRIPTION INTEGRATION
// ============================================================================

const RAZORPAY_KEY_ID = ENV.razorpayKeyId;
const RAZORPAY_KEY_SECRET = ENV.razorpayKeySecret;

// ============================================================================
// Pricing tiers (Sprint 2)
//
// We bill in two currencies for two ICPs:
//   - INR via Razorpay (default for Indian/SEA mid-market)
//   - USD via Stripe (default for global self-serve)
//
// `amount` is the INR amount in paise; `usdAmount` is the USD amount in cents.
// The `currency` advertised to the buyer is selected at checkout based on
// region; both rails are kept in sync here so the dashboard can render either.
//
// Pricing rationale (see MARKET_ANALYSIS.md §5.3): the previous tiers were
// ₹999 / ₹4,999 per month — well below CAC for any cybersecurity SaaS. The
// proposed bands below are 5–10× higher and align to comparable AI-security
// vendor list prices (Snyk Team $25/dev/mo, Salt avg $70K ACV, etc.).
//
// Razorpay's plan API requires INR plans to be created server-side per cycle,
// so the helper functions below take care of provisioning a Razorpay plan for
// each tier on first checkout.
// ============================================================================

// We bill three on-platform tiers (`free` / `pro` / `enterprise`) at the
// database level today — these are the values the `users.plan` mysqlEnum
// accepts. "Business" and "Scale" are roadmap labels surfaced in marketing
// copy; once the new SKUs are billable they will be added via DB migration.
const PLAN_CONFIG = {
  free: {
    name: "DevPulse Free",
    amount: 0,
    usdAmount: 0,
    currency: "INR",
    interval: "monthly",
    features: [
      "Up to 5 API endpoints scanned",
      "100 LLM calls/day routed via the gateway",
      "OWASP Top 10 audit (read-only)",
      "Community support",
    ],
    limits: {
      maxCollections: 2,
      maxScansPerDay: 3,
      maxScansPerHour: 1,
      maxTeamMembers: 1,
      maxGatewayCallsPerDay: 100,
      maxGatewayCallsPerHour: 20,
      maxGatewayCallsPerWeek: 500,
      complianceExport: false,
      killSwitch: false,
      shadowAPI: false,
    },
  },
  pro: {
    name: "DevPulse Pro",
    amount: 829900, // ₹8,299/mo (≈ $99 USD)
    usdAmount: 9900, // $99/mo in cents
    currency: "INR",
    interval: "monthly",
    features: [
      "Up to 10,000 LLM calls/day routed via the gateway",
      "Unlimited API collections + Postman/OpenAPI scans",
      "Inline kill-switch + budget caps",
      "PII redaction at the gateway",
      "85+ prompt-injection payload red-team library",
      "Spec-drift / shadow API detection",
      "Token analytics + per-model cost forecasting",
      "Up to 5 team members",
      "Email support, 1-business-day SLA",
    ],
    limits: {
      maxCollections: Infinity,
      maxScansPerDay: Infinity,
      maxScansPerHour: Infinity,
      maxTeamMembers: 5,
      maxGatewayCallsPerDay: 10_000,
      maxGatewayCallsPerHour: 2_000,
      maxGatewayCallsPerWeek: 50_000,
      complianceExport: true,
      killSwitch: true,
      shadowAPI: true,
    },
  },
  enterprise: {
    name: "DevPulse Business",
    amount: 4159900, // ₹41,599/mo (≈ $499 USD)
    usdAmount: 49900, // $499/mo in cents
    currency: "INR",
    interval: "monthly",
    features: [
      "Up to 250,000 LLM calls/day routed via the gateway",
      "Everything in Pro",
      "MCP governance: tool-call audit + permission graph",
      "Scheduled AI red-team runs",
      "Up to 25 team members + RBAC roles",
      "OWASP / PCI-prep / GDPR-prep / SOC2-prep evidence export",
      "Slack + webhook + PagerDuty alerting",
      "Priority support, 4-hour SLA on P1",
    ],
    limits: {
      maxCollections: Infinity,
      maxScansPerDay: Infinity,
      maxScansPerHour: Infinity,
      maxTeamMembers: 25,
      maxGatewayCallsPerDay: 250_000,
      maxGatewayCallsPerHour: 50_000,
      maxGatewayCallsPerWeek: 1_000_000,
      complianceExport: true,
      killSwitch: true,
      shadowAPI: true,
      mcpGovernance: true,
      sso: true,
      prioritySupport: true,
    },
  },
} as const;

type PlanType = keyof typeof PLAN_CONFIG;

interface RazorpayPlanResponse {
  id: string;
  entity: string;
  interval: number;
  period: string;
  item: {
    id: string;
    name: string;
    amount: number;
    currency: string;
  };
}

interface RazorpaySubscriptionResponse {
  id: string;
  entity: string;
  plan_id: string;
  customer_id: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "paused";
  current_start?: number;
  current_end?: number;
  ended_at?: number;
  charge_at?: number;
  short_url?: string;
}

interface RazorpayCustomerResponse {
  id: string;
  entity: string;
  email: string;
  name?: string;
  contact?: string;
}

interface RazorpayWebhookPayload {
  entity: "event";
  account_id: string;
  event:
    | "subscription.activated"
    | "subscription.charged"
    | "subscription.cancelled"
    | "subscription.paused"
    | "subscription.resumed"
    | "subscription.halted"
    | "payment.failed"
    | "payment.captured"
    | "refund.processed";
  contains: any[];
  payload: {
    payment?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
        order_id: string;
        invoice_id?: string;
        subscription_id?: string;
        captured: boolean;
        email: string;
        contact?: string;
        created_at: number;
        error_code?: string;
        error_description?: string;
      };
    };
    subscription?: {
      entity: RazorpaySubscriptionResponse;
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        amount: number;
        status: string;
        created_at: number;
      };
    };
  };
  created_at: number;
}

const authHeader = () => {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new InternalError(
      "Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      {
        safeMessage: "Billing is temporarily unavailable. Please try again shortly.",
      },
    );
  }
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`;
};

/**
 * Get or create Razorpay plan for a DevPulse plan tier
 */
async function getOrCreatePlan(plan: PlanType): Promise<string> {
  const planConfig = PLAN_CONFIG[plan];
  const planName = `devpulse_${plan}_monthly`;

  // Try to find existing plan
  const listResponse = await fetchWithTimeout(`https://api.razorpay.com/v1/plans?count=100`, {
    headers: { Authorization: authHeader() },
  });

  if (!listResponse.ok) {
    throw new BillingProviderError(`Razorpay list-plans failed (${listResponse.status})`, {
      safeMessage: "Could not load billing plans. Please try again.",
      context: {
        provider: "razorpay",
        status: listResponse.status,
        body: await listResponse.text(),
      },
    });
  }

  const { items: plans } = await listResponse.json();
  const existingPlan = plans.find((p: any) => p.item.name === planName);

  if (existingPlan) {
    return existingPlan.id;
  }

  // Create new plan
  const createResponse = await fetchWithTimeout("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: {
        name: planName,
        amount: planConfig.amount,
        currency: planConfig.currency,
        description: `${planConfig.name} - Monthly Subscription`,
      },
    }),
  });

  if (!createResponse.ok) {
    throw new BillingProviderError(`Razorpay create-plan failed (${createResponse.status})`, {
      safeMessage: "Could not create the billing plan. Please try again.",
      context: {
        provider: "razorpay",
        status: createResponse.status,
        body: await createResponse.text(),
      },
    });
  }

  const newPlan: RazorpayPlanResponse = await createResponse.json();
  return newPlan.id;
}

/**
 * Create or get Razorpay customer
 */
async function getOrCreateCustomer(userId: number, email: string, name?: string): Promise<string> {
  // Try to find existing customer by email
  const listResponse = await fetchWithTimeout(`https://api.razorpay.com/v1/customers?count=100`, {
    headers: { Authorization: authHeader() },
  });

  if (!listResponse.ok) {
    throw new BillingProviderError(`Razorpay list-customers failed (${listResponse.status})`, {
      safeMessage: "Could not look up your billing profile. Please try again.",
      context: {
        provider: "razorpay",
        status: listResponse.status,
        body: await listResponse.text(),
      },
    });
  }

  const { items: customers } = await listResponse.json();
  const existingCustomer = customers.find((c: any) => c.email === email);

  if (existingCustomer) {
    return existingCustomer.id;
  }

  // Create new customer
  const createResponse = await fetchWithTimeout("https://api.razorpay.com/v1/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      name: name || email.split("@")[0],
      email,
      notes: {
        userId: userId.toString(),
      },
    }),
  });

  if (!createResponse.ok) {
    throw new BillingProviderError(`Razorpay create-customer failed (${createResponse.status})`, {
      safeMessage: "Could not create your billing profile. Please try again.",
      context: {
        provider: "razorpay",
        status: createResponse.status,
        body: await createResponse.text(),
      },
    });
  }

  const newCustomer: RazorpayCustomerResponse = await createResponse.json();
  return newCustomer.id;
}

/**
 * Create a Razorpay subscription for recurring billing.
 */
export async function createSubscription(
  userId: number,
  userEmail: string,
  plan: Exclude<PlanType, "free">,
  name?: string,
): Promise<{
  subscriptionId: string;
  customerId: string;
  shortUrl?: string;
  status: string;
  planName: string;
  amount: number;
  currency: string;
  keyId: string;
  features: readonly string[];
}> {
  const planId = await getOrCreatePlan(plan);
  const customerId = await getOrCreateCustomer(userId, userEmail, name);

  const planConfig = PLAN_CONFIG[plan];

  const response = await fetchWithTimeout("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      plan_id: planId,
      customer_id: customerId,
      total_count: 12, // 1 year
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId: userId.toString(),
        userEmail,
        plan,
      },
    }),
  });

  if (!response.ok) {
    throw new BillingProviderError(`Razorpay subscription-create failed (${response.status})`, {
      safeMessage: "Could not start your subscription. Please try again or contact support.",
      context: {
        provider: "razorpay",
        status: response.status,
        body: await response.text(),
      },
    });
  }

  const subscription: RazorpaySubscriptionResponse = await response.json();

  return {
    subscriptionId: subscription.id,
    customerId,
    shortUrl: subscription.short_url,
    status: subscription.status,
    planName: planConfig.name,
    amount: planConfig.amount,
    currency: planConfig.currency,
    keyId: RAZORPAY_KEY_ID!,
    features: planConfig.features,
  };
}

/**
 * Verify Razorpay payment signature after frontend payment completion.
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!RAZORPAY_KEY_SECRET) {
    logger.error("[Razorpay] Key secret not configured — cannot verify signature");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(params.signature, "hex"),
  );
}

/**
 * Fetch payment details from Razorpay.
 */
export async function getPaymentDetails(paymentId: string): Promise<any> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new InternalError("Razorpay credentials not configured", {
      safeMessage: "Billing is temporarily unavailable. Please try again shortly.",
    });
  }

  const response = await fetchWithTimeout(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new BillingProviderError(`Razorpay get-payment failed (${response.status})`, {
      safeMessage: "Could not load payment details. Please try again.",
      context: { provider: "razorpay", paymentId, status: response.status },
    });
  }

  return response.json();
}

/**
 * Process a refund via Razorpay.
 */
export async function processRefund(
  paymentId: string,
  amount: number,
  reason: string = "User requested refund",
): Promise<any> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new InternalError("Razorpay credentials not configured", {
      safeMessage: "Refunds are temporarily unavailable. Please try again shortly.",
    });
  }

  const response = await fetchWithTimeout(
    `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount,
        notes: { reason },
      }),
    },
  );

  if (!response.ok) {
    throw new BillingProviderError(`Razorpay refund failed (${response.status})`, {
      safeMessage: "Refund could not be processed. Please contact support.",
      context: { provider: "razorpay", paymentId, amount, status: response.status },
    });
  }

  return response.json();
}

/**
 * Cancel a Razorpay subscription.
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true,
): Promise<any> {
  const endpoint = cancelAtCycleEnd
    ? `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`
    : `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel?cancel_at_cycle_end=0`;

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
  });

  if (!response.ok) {
    throw new BillingProviderError(`Razorpay cancel-subscription failed (${response.status})`, {
      safeMessage: "Could not cancel your subscription. Please try again.",
      context: {
        provider: "razorpay",
        subscriptionId,
        status: response.status,
        body: await response.text(),
      },
    });
  }

  return response.json();
}

/**
 * Fetch subscription details from Razorpay.
 */
export async function getSubscriptionDetails(subscriptionId: string): Promise<any> {
  const response = await fetchWithTimeout(
    `https://api.razorpay.com/v1/subscriptions/${subscriptionId}`,
    {
      headers: { Authorization: authHeader() },
    },
  );

  if (!response.ok) {
    throw new BillingProviderError(`Razorpay get-subscription failed (${response.status})`, {
      safeMessage: "Could not load subscription details. Please try again.",
      context: { provider: "razorpay", subscriptionId, status: response.status },
    });
  }

  return response.json();
}

/**
 * Fetch subscription invoices from Razorpay.
 */
export async function getSubscriptionInvoices(subscriptionId: string): Promise<any[]> {
  const response = await fetchWithTimeout(
    `https://api.razorpay.com/v1/invoices?subscription_id=${subscriptionId}`,
    { headers: { Authorization: authHeader() } },
  );

  if (!response.ok) {
    throw new BillingProviderError(`Razorpay get-invoices failed (${response.status})`, {
      safeMessage: "Could not load invoices. Please try again.",
      context: { provider: "razorpay", subscriptionId, status: response.status },
    });
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Verify Razorpay webhook signature.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string = RAZORPAY_KEY_SECRET || "",
): boolean {
  if (!secret) {
    logger.error("[Razorpay] Webhook secret not configured");
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(signature, "hex"),
  );
}

/**
 * Handle Razorpay webhook events.
 * Returns normalized event data for database storage.
 */
export function handleWebhookEvent(payload: RazorpayWebhookPayload): {
  event: string;
  subscriptionId?: string;
  paymentId?: string;
  refundId?: string;
  data: any;
} {
  const event = payload.event;
  const result: any = { event, data: payload };

  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.cancelled":
    case "subscription.paused":
    case "subscription.resumed":
    case "subscription.halted":
      result.subscriptionId = payload.payload.subscription?.entity.id;
      break;

    case "payment.captured":
    case "payment.failed":
      result.paymentId = payload.payload.payment?.entity.id;
      result.subscriptionId = payload.payload.payment?.entity.subscription_id;
      break;

    case "refund.processed":
      result.refundId = payload.payload.refund?.entity.id;
      result.paymentId = payload.payload.refund?.entity.payment_id;
      break;
  }

  return result;
}

/**
 * Get plan limits for enforcement.
 */
export function getPlanLimits(plan: PlanType) {
  return PLAN_CONFIG[plan].limits;
}

/**
 * Check if a feature is available for a given plan.
 */
export function isFeatureAvailable(
  plan: PlanType,
  feature: keyof (typeof PLAN_CONFIG)["free"]["limits"],
): boolean {
  const limits = PLAN_CONFIG[plan].limits;
  return feature in limits ? Boolean(limits[feature as keyof typeof limits]) : true;
}

export { PLAN_CONFIG, type PlanType, type RazorpayWebhookPayload };
