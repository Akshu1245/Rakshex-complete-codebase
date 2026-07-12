import { describe, expect, it } from "vitest";
import {
  applyCoupon,
  applyEntitlementFromWebhook,
  applyTax,
  computeOverageCents,
  MemoryBillingProvider,
  PLAN_CATALOG,
} from "./provider";

describe("billing provider", () => {
  it("does not allow client-side free→enterprise assignment via checkout only for paid plans", async () => {
    const p = new MemoryBillingProvider();
    await expect(
      p.createCheckoutSession({
        workspaceId: "ws1",
        customerEmail: "a@b.com",
        planId: "pro",
        interval: "month",
        successUrl: "https://app/ok",
        cancelUrl: "https://app/cancel",
      }),
    ).resolves.toMatchObject({ provider: "stripe" });
    // free is not a checkout plan
    expect(PLAN_CATALOG.free.monthlyPriceCents).toBe(0);
  });

  it("duplicate webhooks are safe (idempotent)", async () => {
    const p = new MemoryBillingProvider();
    const event = {
      id: "evt_1",
      type: "customer.subscription.updated",
      rawBody: "{}",
      signature: "sig_secret_2",
      provider: "stripe" as const,
    };
    expect(p.verifyWebhook(event, "secret")).toBe(true);
    const first = await p.processWebhook(event);
    const second = await p.processWebhook(event);
    expect(first.duplicate).toBeFalsy();
    expect(second.duplicate).toBe(true);
    expect(applyEntitlementFromWebhook(second, "pro")).toBe("pro");
  });

  it("failed payments update entitlements to free/past_due", async () => {
    const p = new MemoryBillingProvider();
    const result = await p.processWebhook({
      id: "evt_fail",
      type: "invoice.payment_failed",
      rawBody: "{}",
      signature: "x",
      provider: "stripe",
    });
    expect(result.entitlementPlan).toBe("free");
    expect(result.status).toBe("past_due");
    expect(applyEntitlementFromWebhook(result, "pro")).toBe("free");
  });

  it("computes overage, coupons, and GST", () => {
    expect(computeOverageCents("pro", 10_050)).toBe(50);
    expect(applyCoupon(10000, { percentOff: 10 })).toBe(9000);
    const tax = applyTax(10000, { country: "IN" });
    expect(tax.rate).toBe(0.18);
    expect(tax.totalCents).toBe(11800);
  });
});
