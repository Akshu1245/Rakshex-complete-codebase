import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import crypto from "crypto";
import Razorpay from "razorpay";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import * as db from "../db";
import { logger } from "../_core/logger";
import { ENV } from "../_core/env";
import {
  createSubscription,
  cancelSubscription,
  getSubscriptionDetails,
  getSubscriptionInvoices,
  verifyWebhookSignature,
  handleWebhookEvent,
  getPlanLimits,
  PLAN_CONFIG,
  type RazorpayWebhookPayload,
  processRefund,
} from "../payments";
import { computePlanUtilization } from "../utils/planLimits";

export const paymentsRouter = router({
  createSubscription: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["pro", "enterprise"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const planConfig = PLAN_CONFIG[input.plan];
      if (!planConfig) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid plan" });
      }

      const result = await createSubscription(ctx.user.id, ctx.user.email || "", input.plan);

      await db.createSubscription({
        id: nanoid(),
        userId: ctx.user.id,
        plan: input.plan,
        razorpaySubscriptionId: result.subscriptionId,
        razorpayCustomerId: result.customerId,
        status: "created",
      });

      return {
        subscriptionId: result.subscriptionId,
        customerId: result.customerId,
        shortUrl: result.shortUrl,
        keyId: result.keyId,
      };
    }),

  cancel: protectedProcedure
    .input(
      z.object({
        immediately: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const subscription = await db.getSubscriptionByUserId(ctx.user.id);
      if (!subscription?.razorpaySubscriptionId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription found",
        });
      }

      const result = await cancelSubscription(
        subscription.razorpaySubscriptionId,
        !input.immediately,
      );

      await db.updateSubscriptionStatus(
        subscription.id,
        input.immediately ? "cancelled" : "active",
        !input.immediately,
      );

      if (input.immediately) {
        await db.updateUserPlan(ctx.user.id, "free");
        await db.updateUserSubscriptionId(ctx.user.id, null);
      }

      return { success: true, status: result.status };
    }),

  getInvoices: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await db.getSubscriptionByUserId(ctx.user.id);
    if (!subscription?.razorpaySubscriptionId) {
      return { invoices: [] };
    }

    const invoices = await getSubscriptionInvoices(subscription.razorpaySubscriptionId);

    for (const invoice of invoices) {
      if (invoice.payment_id && invoice.amount) {
        await db.createPayment({
          id: nanoid(),
          userId: ctx.user.id,
          subscriptionId: subscription.id,
          razorpayPaymentId: invoice.payment_id,
          razorpayOrderId: invoice.order_id,
          amount: invoice.amount / 100,
          currency: invoice.currency || "INR",
          status: invoice.status === "paid" ? "captured" : "created",
          receipt: invoice.receipt_number,
          description: invoice.description,
          createdAt: new Date(invoice.date * 1000),
        });
      }
    }

    const payments = await db.getPaymentsByUserId(ctx.user.id);

    return {
      invoices: payments.map((p) => ({
        id: p.id,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        receipt: p.receipt,
        description: p.description,
        createdAt: p.createdAt,
      })),
    };
  }),

  handleWebhook: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
    const signature = ctx.req.headers["x-razorpay-signature"] as string;
    const payload = JSON.stringify(input);

    if (!verifyWebhookSignature(payload, signature)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid webhook signature",
      });
    }

    const event = handleWebhookEvent(input as RazorpayWebhookPayload);

    switch (event.event) {
      case "subscription.activated":
        if (event.subscriptionId) {
          const sub = await db.getSubscriptionByRazorpayId(event.subscriptionId);
          if (sub) {
            await db.updateSubscriptionStatus(sub.id, "active");
            await db.updateUserPlan(sub.userId, sub.plan);
          }
        }
        break;

      case "subscription.charged":
        if (event.data.payload.payment?.entity) {
          const payment = event.data.payload.payment.entity;
          const sub = await db.getSubscriptionByRazorpayId(payment.subscription_id);
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
        break;

      case "subscription.cancelled":
        if (event.subscriptionId) {
          const sub = await db.getSubscriptionByRazorpayId(event.subscriptionId);
          if (sub) {
            await db.updateSubscriptionStatus(sub.id, "cancelled");
            await db.updateUserPlan(sub.userId, "free");
            await db.updateUserSubscriptionId(sub.userId, null);
          }
        }
        break;

      case "payment.failed":
        if (event.data.payload.payment?.entity) {
          const payment = event.data.payload.payment.entity;
          const sub = await db.getSubscriptionByRazorpayId(payment.subscription_id);
          if (sub) {
            await db.updateSubscriptionStatus(sub.id, "past_due");

            // Dunning: send retry email on first failure, downgrade after 3 failures
            const user = await db.getUserById(sub.userId);
            const failureCount = (await db.getPaymentsByUserId(sub.userId)).filter(
              (p) =>
                p.status === "failed" &&
                p.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            ).length;

            if (user?.email) {
              const { sendPaymentFailedEmail } = await import("../email");
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
              await db.updateUserPlan(sub.userId, "free");
              await db.updateSubscriptionStatus(sub.id, "cancelled");
              logger.info(
                { userId: sub.userId, subId: sub.id },
                "[Payments] Downgraded to free after 3 failed payments",
              );
            }
          }
        }
        break;

      case "refund.processed":
        if (event.data.payload.refund?.entity) {
          const refund = event.data.payload.refund.entity;
          await db.updatePaymentRefundStatus(refund.payment_id, refund.amount / 100, "full");
        }
        break;
    }

    return { received: true };
  }),

  getPlans: publicProcedure.query(() => {
    return Object.entries(PLAN_CONFIG).map(([key, config]) => ({
      id: key,
      name: config.name,
      amount: config.amount,
      currency: config.currency,
      interval: config.interval,
      features: [...config.features],
      limits: config.limits,
    }));
  }),

  getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await db.getSubscriptionByUserId(ctx.user.id);
    const effectivePlan = await db.getEffectivePlan(ctx.user.id);
    const trial = await db.getTrialStatus(ctx.user.id);
    const limits = getPlanLimits(effectivePlan);

    // Utilization — inspired by Claude Code's `getRawUtilization()`. The
    // dashboard banner and VS Code status bar read this to show proactive
    // "you've used 75% of your daily scans" warnings.
    const [collections, dailyScans] = await Promise.all([
      db.getCollectionsByUserId(ctx.user.id),
      (async () => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await db.getRecentScans(ctx.user.id, 100);
        return recent.filter((s) => s.createdAt >= since).length;
      })(),
    ]);
    const utilization = computePlanUtilization(effectivePlan, collections.length, dailyScans);

    return {
      plan: subscription?.plan || "free",
      effectivePlan,
      status: subscription?.status || "none",
      trial,
      limits,
      utilization,
    };
  }),

  // One-time payment: create a Razorpay order
  createOrder: protectedProcedure
    .input(
      z.object({
        amount: z.number().min(100, "Minimum amount is 100 paise (₹1)"),
        currency: z.string().default("INR"),
        receipt: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ENV.razorpayKeyId || !ENV.razorpayKeySecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Razorpay payment integration not configured on server",
        });
      }

      const razorpay = new Razorpay({
        key_id: ENV.razorpayKeyId,
        key_secret: ENV.razorpayKeySecret,
      });

      try {
        const order = await razorpay.orders.create({
          amount: input.amount,
          currency: input.currency,
          receipt: input.receipt || `receipt_${Date.now()}_${ctx.user.id}`,
        });

        logger.info(
          { order_id: order.id, amount: input.amount, user: ctx.user.id },
          "[Razorpay] Order created via tRPC",
        );

        return {
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
        };
      } catch (error: any) {
        logger.error({ err: error }, "[Razorpay] Order creation failed via tRPC");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create Razorpay order",
        });
      }
    }),

  // One-time payment: verify payment signature
  verifyPayment: protectedProcedure
    .input(
      z.object({
        razorpay_payment_id: z.string(),
        razorpay_order_id: z.string(),
        razorpay_signature: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ENV.razorpayKeySecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Razorpay payment integration not configured on server",
        });
      }

      const body = input.razorpay_order_id + "|" + input.razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", ENV.razorpayKeySecret)
        .update(body)
        .digest("hex");

      if (expectedSignature !== input.razorpay_signature) {
        logger.warn(
          { order_id: input.razorpay_order_id },
          "[Razorpay] Signature mismatch via tRPC",
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment verification failed (signature mismatch)",
        });
      }

      logger.info(
        { order_id: input.razorpay_order_id, payment_id: input.razorpay_payment_id },
        "[Razorpay] Payment verified via tRPC",
      );

      // Fetch payment details and save to DB
      try {
        const razorpay = new Razorpay({
          key_id: ENV.razorpayKeyId,
          key_secret: ENV.razorpayKeySecret,
        });
        const paymentDetails = await razorpay.payments.fetch(input.razorpay_payment_id);

        await db.createPayment({
          id: nanoid(),
          userId: ctx.user.id,
          razorpayPaymentId: input.razorpay_payment_id,
          razorpayOrderId: input.razorpay_order_id,
          amount: Number(paymentDetails.amount),
          currency: paymentDetails.currency,
          status: "captured",
          description: paymentDetails.description || "Razorpay Standard Web Checkout",
        });
      } catch (dbErr: any) {
        logger.error({ err: dbErr }, "[Razorpay] Failed to save payment record");
      }

      return { success: true };
    }),
});
