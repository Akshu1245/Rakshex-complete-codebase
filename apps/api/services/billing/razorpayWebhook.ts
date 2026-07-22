/**
 * Canonical Razorpay webhook processor.
 *
 * Claim-first idempotency: the durable processed-event insert is the lock.
 * Concurrent retries lose the claim race and skip side effects. If side
 * effects throw after a successful claim, the claim is released so Razorpay
 * can safely retry.
 */
import { nanoid } from "nanoid";
import * as db from "../../db";
import { upsertWorkspaceEntitlement } from "../../db/workspaceSeats";
import { ENV } from "../../_core/env";
import { logger } from "../../_core/logger";
import { handleWebhookEvent, type RazorpayWebhookPayload } from "../../payments";
import {
  applyPlanEntitlement,
  includedSeatsForPlan,
  normalizeBillablePlan,
  resolveBillingWorkspaceId,
} from "./entitlements";

export type RazorpayProcessResult =
  | { status: "duplicate"; event: string }
  | { status: "ok"; event: string }
  | { status: "ignored"; event: string };

function readNotes(entity: unknown): Record<string, string> {
  if (!entity || typeof entity !== "object") return {};
  const notes = (entity as { notes?: unknown }).notes;
  if (!notes || typeof notes !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(notes as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "number") out[k] = String(v);
  }
  return out;
}

function eventDedupId(payload: RazorpayWebhookPayload, eventName: string): string {
  const paymentId = payload.payload?.payment?.entity?.id;
  const subscriptionId = payload.payload?.subscription?.entity?.id;
  const refundId = payload.payload?.refund?.entity?.id;
  const raw = paymentId || subscriptionId || refundId || (payload as { id?: string }).id;
  if (typeof raw === "string" && raw.length > 0) return raw;
  return `${eventName}:${JSON.stringify(payload.payload ?? {}).slice(0, 120)}`;
}

async function applyRazorpaySideEffects(
  payload: RazorpayWebhookPayload,
  eventName: string,
  parsed: ReturnType<typeof handleWebhookEvent>,
): Promise<"ok" | "ignored"> {
  switch (eventName) {
    case "subscription.activated": {
      if (parsed.subscriptionId) {
        const sub = await db.getSubscriptionByRazorpayId(parsed.subscriptionId);
        if (sub) {
          await db.updateSubscriptionStatus(sub.id, "active");
          const notes = readNotes(payload.payload?.subscription?.entity);
          await applyPlanEntitlement({
            userId: sub.userId,
            plan: normalizeBillablePlan(sub.plan),
            status: "active",
            workspaceId: notes.workspaceId,
            billingProvider: "razorpay",
            billingSubscriptionId: parsed.subscriptionId,
            billingCustomerId: sub.razorpayCustomerId,
          });
        }
      }
      return "ok";
    }
    case "subscription.charged": {
      if (payload.payload?.payment?.entity) {
        const payment = payload.payload.payment.entity;
        const sub = payment.subscription_id
          ? await db.getSubscriptionByRazorpayId(payment.subscription_id)
          : null;
        if (sub) {
          await db.createPayment({
            id: nanoid(),
            userId: sub.userId,
            subscriptionId: sub.id,
            razorpayPaymentId: payment.id,
            razorpayOrderId: payment.order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: "captured",
            createdAt: new Date(payment.created_at * 1000),
          });
        }
      }
      return "ok";
    }
    case "payment.captured": {
      const paymentEntity = payload.payload?.payment?.entity;
      const notes = readNotes(paymentEntity);
      const userId = Number.parseInt(notes.userId || "0", 10);
      if (userId > 0) {
        await applyPlanEntitlement({
          userId,
          plan: normalizeBillablePlan(notes.plan),
          status: "active",
          workspaceId: notes.workspaceId,
          billingProvider: "razorpay",
          billingSubscriptionId: paymentEntity?.subscription_id,
        });
      }
      return "ok";
    }
    case "subscription.cancelled": {
      if (parsed.subscriptionId) {
        const sub = await db.getSubscriptionByRazorpayId(parsed.subscriptionId);
        if (sub) {
          await db.updateSubscriptionStatus(sub.id, "cancelled");
          await db.updateUserSubscriptionId(sub.userId, null);
          const notes = readNotes(payload.payload?.subscription?.entity);
          await applyPlanEntitlement({
            userId: sub.userId,
            plan: "free",
            status: "canceled",
            workspaceId: notes.workspaceId,
            billingProvider: "razorpay",
            billingSubscriptionId: parsed.subscriptionId,
          });
        }
      } else {
        const notes = readNotes(payload.payload?.subscription?.entity);
        const userId = Number.parseInt(notes.userId || "0", 10);
        if (userId > 0) {
          await applyPlanEntitlement({
            userId,
            plan: "free",
            status: "canceled",
            workspaceId: notes.workspaceId,
            billingProvider: "razorpay",
          });
        }
      }
      return "ok";
    }
    case "payment.failed": {
      const payment = payload.payload?.payment?.entity;
      if (!payment) return "ok";
      const sub = payment.subscription_id
        ? await db.getSubscriptionByRazorpayId(payment.subscription_id)
        : null;
      if (!sub) return "ok";

      // Persist the failed attempt so the dunning counter is durable.
      await db.createPayment({
        id: nanoid(),
        userId: sub.userId,
        subscriptionId: sub.id,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        amount: payment.amount / 100,
        currency: payment.currency,
        status: "failed",
        createdAt: new Date(payment.created_at * 1000),
      });

      await db.updateSubscriptionStatus(sub.id, "past_due");
      const notes = readNotes(payload.payload?.subscription?.entity);
      const workspaceId = await resolveBillingWorkspaceId({
        userId: sub.userId,
        workspaceId: notes.workspaceId,
      });
      if (workspaceId) {
        await upsertWorkspaceEntitlement({
          workspaceId,
          plan: normalizeBillablePlan(sub.plan),
          status: "past_due",
          includedSeats: includedSeatsForPlan(normalizeBillablePlan(sub.plan)),
          purchasedSeats: 0,
          billingProvider: "razorpay",
          billingSubscriptionId: sub.razorpaySubscriptionId,
          billingCustomerId: sub.razorpayCustomerId,
          graceExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      const user = await db.getUserById(sub.userId);
      const failureCount = (await db.getPaymentsByUserId(sub.userId)).filter(
        (p) =>
          p.status === "failed" && p.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      ).length;

      if (user?.email) {
        const { sendPaymentFailedEmail } = await import("../../email");
        await sendPaymentFailedEmail({
          toEmail: user.email,
          userName: user.name ?? "",
          amount: payment.amount / 100,
          currency: payment.currency,
          retryUrl: `${process.env.APP_URL || "https://rakshex.in"}/billing?retry=1`,
          downgradeWarning: failureCount >= 2,
        }).catch((err: unknown) => logger.warn({ err }, "[Payments] Dunning email failed"));
      }

      if (failureCount >= 3) {
        await applyPlanEntitlement({
          userId: sub.userId,
          plan: "free",
          status: "canceled",
          workspaceId: notes.workspaceId,
          billingProvider: "razorpay",
        });
        await db.updateSubscriptionStatus(sub.id, "cancelled");
      }
      return "ok";
    }
    case "refund.processed": {
      const refund = payload.payload?.refund?.entity;
      if (refund?.payment_id && typeof refund.amount === "number") {
        await db.updatePaymentRefundStatus(refund.payment_id, refund.amount / 100, "full");
      }
      return "ok";
    }
    default:
      return "ignored";
  }
}

export async function processRazorpayWebhook(
  payload: RazorpayWebhookPayload,
): Promise<RazorpayProcessResult> {
  const parsed = handleWebhookEvent(payload);
  const eventName = parsed.event;
  const eventId = eventDedupId(payload, eventName);

  // Atomic claim first — unique insert is the concurrency lock.
  const claimed = await db.markWebhookEventProcessed("razorpay", eventId, eventName);
  if (!claimed) {
    return { status: "duplicate", event: eventName };
  }

  try {
    const outcome = await applyRazorpaySideEffects(payload, eventName, parsed);
    return { status: outcome, event: eventName };
  } catch (err) {
    await db.releaseWebhookEventClaim("razorpay", eventId);
    throw err;
  }
}

export async function applyStripeCheckoutEntitlement(input: {
  userId: number;
  plan: string;
  workspaceId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  await applyPlanEntitlement({
    userId: input.userId,
    plan: normalizeBillablePlan(input.plan),
    status: "active",
    workspaceId: input.workspaceId,
    billingProvider: "stripe",
    billingCustomerId: input.customerId,
    billingSubscriptionId: input.subscriptionId,
  });
}

export async function applyStripeCancellation(input: {
  userId: number;
  workspaceId?: string | null;
  subscriptionId?: string | null;
}): Promise<void> {
  await applyPlanEntitlement({
    userId: input.userId,
    plan: "free",
    status: "canceled",
    workspaceId: input.workspaceId,
    billingProvider: "stripe",
    billingSubscriptionId: input.subscriptionId,
  });
}

export function assertWebhookDbAvailable(): void {
  if (ENV.isProduction && !ENV.databaseUrl) {
    throw new Error("DATABASE_URL required to process billing webhooks");
  }
}
