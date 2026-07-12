// @ts-nocheck
/**
 * Sprint-2 Stripe scaffolding — unit tests for the bits that work without
 * live keys: signature verification + event-mapping.
 *
 * The Checkout-creation path requires a live key and is exercised via an
 * integration test once the secrets are populated; that test is gated behind
 * `STRIPE_SECRET_KEY` and excluded by default.
 */
import crypto from "crypto";
import { describe, it, expect } from "vitest";
import { mapStripeEvent, verifyStripeWebhook } from "./stripe";

const SECRET = "whsec_unit_test_secret_value_aaaaaaaaaaaaaaaa";

describe("stripe.verifyStripeWebhook", () => {
  function sign(payload: string, ts: number): string {
    const sig = crypto.createHmac("sha256", SECRET).update(`${ts}.${payload}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }

  it("rejects when no secret configured", () => {
    const r = verifyStripeWebhook("body", "t=1,v1=abc", 300, "");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("no_webhook_secret");
  });

  it("rejects when signature header is missing", () => {
    const r = verifyStripeWebhook("body", "", 300, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("no_signature_header");
  });

  it("rejects malformed headers", () => {
    const r = verifyStripeWebhook("body", "garbage", 300, SECRET);
    expect(r.valid).toBe(false);
  });

  it("rejects stale events outside the tolerance window", () => {
    const ts = Math.floor(Date.now() / 1000) - 999;
    const header = sign("body", ts);
    const r = verifyStripeWebhook("body", header, 300, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("stale_event");
  });

  it("rejects forged signatures", () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=${"0".repeat(64)}`;
    const r = verifyStripeWebhook("body", header, 300, SECRET);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("no_match");
  });

  it("accepts a valid signature", () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = sign("payload-v1", ts);
    const r = verifyStripeWebhook("payload-v1", header, 300, SECRET);
    expect(r.valid).toBe(true);
  });
});

describe("stripe.mapStripeEvent", () => {
  it("maps subscription.created (active) -> subscription_active", () => {
    const action = mapStripeEvent({
      id: "evt_1",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          customer: "cus_1",
          items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    });
    expect(action).toEqual({
      kind: "subscription_active",
      subscriptionId: "sub_1",
      customerId: "cus_1",
      priceId: "price_pro",
    });
  });

  it("maps subscription.updated past_due -> subscription_past_due", () => {
    const action = mapStripeEvent({
      id: "evt_2",
      type: "customer.subscription.updated",
      data: {
        object: { id: "sub_1", status: "past_due", customer: "cus_1" },
      },
    });
    expect(action?.kind).toBe("subscription_past_due");
  });

  it("maps subscription.deleted -> subscription_canceled", () => {
    const action = mapStripeEvent({
      id: "evt_3",
      type: "customer.subscription.deleted",
      data: {
        object: { id: "sub_1", status: "canceled", customer: "cus_1" },
      },
    });
    expect(action?.kind).toBe("subscription_canceled");
  });

  it("maps invoice.payment_succeeded -> invoice_paid", () => {
    const action = mapStripeEvent({
      id: "evt_4",
      type: "invoice.payment_succeeded",
      data: {
        object: { id: "in_1", subscription: "sub_1", customer: "cus_1" },
      },
    });
    expect(action?.kind).toBe("invoice_paid");
  });

  it("returns null for unknown event types", () => {
    const action = mapStripeEvent({
      id: "evt_5",
      type: "charge.refunded",
      data: { object: { id: "ch_1" } },
    });
    expect(action).toBeNull();
  });

  it("returns null for invoice events without subscription id", () => {
    const action = mapStripeEvent({
      id: "evt_6",
      type: "invoice.payment_succeeded",
      data: { object: { id: "in_1" } },
    });
    expect(action).toBeNull();
  });
});
