import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateUserPlan: vi.fn(),
  listWorkspacesForUser: vi.fn(),
  getWorkspaceMembership: vi.fn(),
  upsertWorkspaceEntitlement: vi.fn(),
  isWebhookEventProcessed: vi.fn(),
  markWebhookEventProcessed: vi.fn(),
  releaseWebhookEventClaim: vi.fn(),
  getSubscriptionByRazorpayId: vi.fn(),
  updateSubscriptionStatus: vi.fn(),
  updateUserSubscriptionId: vi.fn(),
  createPayment: vi.fn(),
  getUserById: vi.fn(),
  getPaymentsByUserId: vi.fn(),
  updatePaymentRefundStatus: vi.fn(),
}));

vi.mock("../../db", () => mocks);
vi.mock("../../db/workspaceSeats", () => ({
  upsertWorkspaceEntitlement: mocks.upsertWorkspaceEntitlement,
}));
vi.mock("../../_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../_core/env", () => ({
  ENV: { isProduction: false, databaseUrl: "postgres://x" },
}));
vi.mock("../../email", () => ({
  sendPaymentFailedEmail: vi.fn(),
}));

import { applyPlanEntitlement, includedSeatsForPlan } from "./entitlements";
import { processRazorpayWebhook } from "./razorpayWebhook";

describe("billing entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listWorkspacesForUser.mockResolvedValue([
      { id: 11, ownerUserId: 7, role: "owner", name: "Acme" },
    ]);
    mocks.getWorkspaceMembership.mockResolvedValue({ active: true });
    mocks.updateUserPlan.mockResolvedValue(undefined);
    mocks.upsertWorkspaceEntitlement.mockResolvedValue(undefined);
  });

  it("maps seats from plan catalog", () => {
    expect(includedSeatsForPlan("free")).toBe(1);
    expect(includedSeatsForPlan("pro")).toBe(5);
    expect(includedSeatsForPlan("enterprise")).toBe(25);
  });

  it("upserts workspace entitlement when applying a paid plan", async () => {
    const result = await applyPlanEntitlement({
      userId: 7,
      plan: "pro",
      workspaceId: 11,
      billingProvider: "razorpay",
      billingSubscriptionId: "sub_1",
    });

    expect(result.workspaceId).toBe(11);
    expect(mocks.updateUserPlan).toHaveBeenCalledWith(7, "pro");
    expect(mocks.upsertWorkspaceEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 11,
        plan: "pro",
        status: "active",
        includedSeats: 5,
        billingProvider: "razorpay",
        billingSubscriptionId: "sub_1",
      }),
    );
  });
});

describe("processRazorpayWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isWebhookEventProcessed.mockResolvedValue(false);
    mocks.markWebhookEventProcessed.mockResolvedValue(true);
    mocks.listWorkspacesForUser.mockResolvedValue([
      { id: 11, ownerUserId: 7, role: "owner", name: "Acme" },
    ]);
    mocks.getWorkspaceMembership.mockResolvedValue({ active: true });
    mocks.updateUserPlan.mockResolvedValue(undefined);
    mocks.upsertWorkspaceEntitlement.mockResolvedValue(undefined);
    mocks.updateSubscriptionStatus.mockResolvedValue(undefined);
  });

  it("claims the event before applying entitlement side effects", async () => {
    const order: string[] = [];
    mocks.upsertWorkspaceEntitlement.mockImplementation(async () => {
      order.push("entitlement");
    });
    mocks.markWebhookEventProcessed.mockImplementation(async () => {
      order.push("claim");
      return true;
    });
    mocks.getSubscriptionByRazorpayId.mockResolvedValue({
      id: "local_sub",
      userId: 7,
      plan: "pro",
      razorpayCustomerId: "cust_1",
      razorpaySubscriptionId: "sub_rzp",
    });

    const result = await processRazorpayWebhook({
      entity: "event",
      account_id: "acc",
      event: "subscription.activated",
      contains: [],
      created_at: 1,
      payload: {
        subscription: {
          entity: {
            id: "sub_rzp",
            entity: "subscription",
            plan_id: "plan_1",
            customer_id: "cust_1",
            status: "active",
            notes: { workspaceId: "11", userId: "7", plan: "pro" },
          } as never,
        },
      },
    });

    expect(result).toEqual({ status: "ok", event: "subscription.activated" });
    expect(order).toEqual(["claim", "entitlement"]);
    expect(mocks.upsertWorkspaceEntitlement).toHaveBeenCalled();
  });

  it("returns duplicate without re-applying when the claim loses", async () => {
    mocks.markWebhookEventProcessed.mockResolvedValue(false);

    const result = await processRazorpayWebhook({
      entity: "event",
      account_id: "acc",
      event: "payment.captured",
      contains: [],
      created_at: 1,
      payload: {
        payment: {
          entity: {
            id: "pay_1",
            amount: 100,
            currency: "INR",
            status: "captured",
            method: "card",
            order_id: "order_1",
            captured: true,
            email: "a@b.c",
            created_at: 1,
            notes: { userId: "7", plan: "pro", workspaceId: "11" },
          } as never,
        },
      },
    });

    expect(result.status).toBe("duplicate");
    expect(mocks.updateUserPlan).not.toHaveBeenCalled();
    expect(mocks.upsertWorkspaceEntitlement).not.toHaveBeenCalled();
  });

  it("releases the claim when side effects fail so Razorpay can retry", async () => {
    mocks.markWebhookEventProcessed.mockResolvedValue(true);
    mocks.getSubscriptionByRazorpayId.mockResolvedValue({
      id: "local_sub",
      userId: 7,
      plan: "pro",
      razorpayCustomerId: "cust_1",
      razorpaySubscriptionId: "sub_rzp",
    });
    mocks.upsertWorkspaceEntitlement.mockRejectedValue(new Error("db down"));

    await expect(
      processRazorpayWebhook({
        entity: "event",
        account_id: "acc",
        event: "subscription.activated",
        contains: [],
        created_at: 1,
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp",
              entity: "subscription",
              plan_id: "plan_1",
              customer_id: "cust_1",
              status: "active",
              notes: { workspaceId: "11", userId: "7", plan: "pro" },
            } as never,
          },
        },
      }),
    ).rejects.toThrow(/db down/);

    expect(mocks.releaseWebhookEventClaim).toHaveBeenCalledWith("razorpay", "sub_rzp");
  });
});
