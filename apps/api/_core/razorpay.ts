import type { Express, Request, Response } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { logger } from "./logger";
import * as db from "../db";

export function registerRazorpayRoutes(app: Express) {
  // Order creation endpoint
  app.post("/api/create-order", async (req: Request, res: Response) => {
    try {
      // 1. Authenticate user
      const user = await sdk.authenticateRequest(req).catch(() => null);
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // 2. Validate request body
      const { amount, currency, receipt } = req.body;
      if (amount === undefined || amount === null) {
        res.status(400).json({ error: "Amount is required" });
        return;
      }

      const parsedAmount = parseInt(amount, 10);
      if (isNaN(parsedAmount) || parsedAmount < 100) {
        res.status(400).json({ error: "Amount must be a number and at least 100 paise (1 INR)" });
        return;
      }

      // Check key config
      if (!ENV.razorpayKeyId || !ENV.razorpayKeySecret) {
        logger.error("[Razorpay] API keys not configured");
        res.status(500).json({ error: "Razorpay payment integration not configured on server" });
        return;
      }

      // 3. Call Razorpay API to create order
      const razorpay = new Razorpay({
        key_id: ENV.razorpayKeyId,
        key_secret: ENV.razorpayKeySecret,
      });

      const order = await razorpay.orders.create({
        amount: parsedAmount,
        currency: currency || "INR",
        receipt: receipt || `receipt_${Date.now()}_${user.id}`,
      });

      res.status(200).json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (error: any) {
      logger.error({ err: error }, "[Razorpay] Order creation failed");
      if (error.statusCode === 401) {
        res.status(401).json({ error: "Razorpay authentication failed. Please verify API keys." });
      } else {
        res.status(500).json({ error: error.message || "Failed to create Razorpay order" });
      }
    }
  });

  // Signature verification endpoint
  app.post("/api/verify-payment", async (req: Request, res: Response) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        res.status(400).json({ error: "Missing required signature verification fields" });
        return;
      }

      if (!ENV.razorpayKeySecret) {
        logger.error("[Razorpay] API Key secret not configured");
        res.status(500).json({ error: "Razorpay payment integration not configured on server" });
        return;
      }

      // Verify signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", ENV.razorpayKeySecret)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature === razorpay_signature) {
        logger.info(
          { order_id: razorpay_order_id },
          "[Razorpay] Signature verification successful",
        );

        // Fetch payment details to verify details & record in DB
        let paymentDetails: any = null;
        try {
          const razorpay = new Razorpay({
            key_id: ENV.razorpayKeyId,
            key_secret: ENV.razorpayKeySecret,
          });
          paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        } catch (err) {
          logger.error({ err }, "[Razorpay] Failed to fetch payment details from Razorpay");
        }

        // Try to save to DB if user is authenticated and DB is available
        const user = await sdk.authenticateRequest(req).catch(() => null);
        if (user && paymentDetails) {
          try {
            const { nanoid } = await import("nanoid");
            await db.createPayment({
              id: nanoid(),
              userId: user.id,
              razorpayPaymentId: razorpay_payment_id,
              razorpayOrderId: razorpay_order_id,
              amount: paymentDetails.amount, // in paise
              currency: paymentDetails.currency,
              status: "captured",
              description: paymentDetails.description || "Razorpay Standard Web Checkout",
            });
          } catch (dbErr) {
            logger.error({ err: dbErr }, "[Razorpay] Failed to save payment record to database");
          }
        }

        res.status(200).json({ status: "success", message: "Payment verified successfully" });
      } else {
        logger.warn(
          { order_id: razorpay_order_id, razorpay_signature, expectedSignature },
          "[Razorpay] Signature mismatch",
        );
        res
          .status(400)
          .json({ status: "failed", error: "Payment verification failed (signature mismatch)" });
      }
    } catch (error: any) {
      logger.error({ err: error }, "[Razorpay] Verification endpoint crashed");
      res.status(500).json({ error: error.message || "Failed to verify Razorpay payment" });
    }
  });
}
