// @ts-nocheck
/**
 * Payments Router Tests - Phase 21 Testing
 * Tests for Razorpay payment integration
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { generateCsrfToken } from "../utils/security";

vi.mock("../payments", () => ({
  createSubscription: vi.fn(async (userId: number, email: string, plan: string) => ({
    subscriptionId: `sub_${Date.now()}`,
    customerId: `cust_${Date.now()}`,
    shortUrl: "https://razorpay.com/pay/test",
    status: "created",
    planName: plan === "enterprise" ? "Rakshex Enterprise" : "Rakshex Pro",
    amount: plan === "enterprise" ? 499900 : 99900,
    currency: "INR",
    keyId: "rzp_test_key",
    features: ["Feature 1", "Feature 2"],
  })),
  cancelSubscription: vi.fn(async (subscriptionId: string, cancelAtCycleEnd: boolean) => ({
    status: cancelAtCycleEnd ? "active" : "cancelled",
    id: subscriptionId,
  })),
  getSubscriptionDetails: vi.fn(async (subscriptionId: string) => ({
    id: subscriptionId,
    status: "active",
    current_start: Date.now() / 1000 - 86400 * 30,
    current_end: Date.now() / 1000 + 86400 * 30,
  })),
  getSubscriptionInvoices: vi.fn(async () => []),
  verifyWebhookSignature: vi.fn(() => true),
  handleWebhookEvent: vi.fn((payload: any) => ({
    event: payload.event || "subscription.activated",
    subscriptionId: payload.payload?.subscription?.entity?.id,
  })),
  getPlanLimits: vi.fn((plan: string) => ({
    maxCollections: plan === "free" ? 2 : Infinity,
    maxScansPerDay: plan === "free" ? 3 : Infinity,
    maxTeamMembers: plan === "enterprise" ? Infinity : plan === "pro" ? 10 : 1,
    complianceExport: plan !== "free",
    killSwitch: plan !== "free",
    shadowAPI: plan !== "free",
  })),
  PLAN_CONFIG: {
    free: { name: "Free", amount: 0, features: [] },
    pro: { name: "Pro", amount: 99900, features: ["All features"] },
    enterprise: {
      name: "Enterprise",
      amount: 499900,
      features: ["All features"],
    },
  },
}));

vi.mock("../db", async () => ({
  getSubscriptionByUserId: vi.fn(async (userId: number) => null),
  getSubscriptionByRazorpayId: vi.fn(async (id: string) => null),
  createSubscription: vi.fn(async () => ({ id: `sub_${Date.now()}` })),
  updateSubscriptionStatus: vi.fn(async () => {}),
  updateUserPlan: vi.fn(async () => {}),
  updateUserSubscriptionId: vi.fn(async () => {}),
  getPaymentsByUserId: vi.fn(async () => []),
  createPayment: vi.fn(async () => ({})),
  updatePaymentRefundStatus: vi.fn(async () => {}),
  getCollectionsByUserId: vi.fn(async () => []),
  getRecentScans: vi.fn(async () => []),
  getEffectivePlan: vi.fn(async (userId: number) => "free"),
  getTrialStatus: vi.fn(async (userId: number) => ({ active: false, remainingDays: 0 })),
  markWebhookEventProcessed: vi.fn(async () => true),
}));

function createAuthContext(userId: number = 1) {
  const csrfToken = generateCsrfToken();
  return {
    ctx: {
      user: {
        id: userId,
        openId: "test-openid",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "test",
        role: "user",
        plan: "free",
        onboardingCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: {
        protocol: "https",
        headers: {
          cookie: `csrf-token=${csrfToken}`,
          "x-csrf-token": csrfToken,
        },
        ip: "127.0.0.1",
      },
      res: { clearCookie: vi.fn(), getHeader: vi.fn() },
    } as unknown as TrpcContext,
  };
}

describe("payments router", () => {
  describe("createSubscription", () => {
    it("throws when user is not authenticated", async () => {
      const ctx = {
        user: null,
        req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
        res: { clearCookie: vi.fn() },
      } as unknown as TrpcContext;
      const caller = appRouter.createCaller(ctx);

      await expect(caller.payment.createSubscription({ plan: "pro" })).rejects.toThrow();
    });

    it("throws for invalid plan", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Zod rejects the unknown plan value before the router's custom check;
      // either behaviour is acceptable, we just want a 4xx-style rejection.
      await expect(caller.payment.createSubscription({ plan: "invalid" as any })).rejects.toThrow();
    });

    it("successfully creates pro subscription", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.payment.createSubscription({ plan: "pro" });

      expect(result.subscriptionId).toBeDefined();
      expect(result.customerId).toBeDefined();
      expect(result.shortUrl).toBeDefined();
      expect(result.keyId).toBeDefined();
    });

    it("successfully creates enterprise subscription", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.payment.createSubscription({
        plan: "enterprise",
      });

      expect(result.subscriptionId).toBeDefined();
      expect(result.customerId).toBeDefined();
    });
  });

  describe("cancel", () => {
    it("throws when user has no subscription", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { getSubscriptionByUserId } = await import("../db");
      vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(null);

      await expect(caller.payment.cancel({ immediately: false })).rejects.toThrow(
        "No active subscription found",
      );
    });

    it("cancels subscription at cycle end when immediately=false", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { getSubscriptionByUserId } = await import("../db");
      vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
        id: "sub_123",
        razorpaySubscriptionId: "sub_razorpay_123",
        plan: "pro",
        status: "active",
      });

      const result = await caller.payment.cancel({ immediately: false });

      expect(result.success).toBe(true);
      expect(result.status).toBe("active"); // Still active until cycle end
    });

    it("immediately cancels subscription when immediately=true", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { getSubscriptionByUserId, updateUserPlan } = await import("../db");
      vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
        id: "sub_123",
        razorpaySubscriptionId: "sub_razorpay_123",
        plan: "pro",
        status: "active",
      });

      const result = await caller.payment.cancel({ immediately: true });

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });
  });

  describe("getPlans", () => {
    it("returns all available plans", async () => {
      const ctx = {
        user: null,
        req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
        res: { clearCookie: vi.fn() },
      } as unknown as TrpcContext;
      const caller = appRouter.createCaller(ctx);

      const result = await caller.payment.getPlans();

      // PLAN_CONFIG currently exposes free, pro, and enterprise so clients
      // can render the full plan ladder. Just assert the paid plans are
      // both present.
      const planIds = result.map((p: any) => p.id);
      expect(planIds).toContain("pro");
      expect(planIds).toContain("enterprise");
    });

    it("includes plan features", async () => {
      const ctx = {
        user: null,
        req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
        res: { clearCookie: vi.fn() },
      } as unknown as TrpcContext;
      const caller = appRouter.createCaller(ctx);

      const result = await caller.payment.getPlans();

      const proPlan = result.find((p: any) => p.id === "pro");
      expect(proPlan.features).toBeDefined();
      expect(Array.isArray(proPlan.features)).toBe(true);
    });
  });

  describe("getCurrentPlan", () => {
    it("returns free plan for users without subscription", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { getSubscriptionByUserId } = await import("../db");
      vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(null);

      const result = await caller.payment.getCurrentPlan();

      expect(result.plan).toBe("free");
      expect(result.limits).toBeDefined();
      expect(result.limits.maxCollections).toBe(2);
    });

    it("returns correct limits for free plan", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { getSubscriptionByUserId } = await import("../db");
      vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(null);

      const result = await caller.payment.getCurrentPlan();

      expect(result.limits.maxScansPerDay).toBe(3);
      expect(result.limits.complianceExport).toBe(false);
      expect(result.limits.killSwitch).toBe(false);
    });

    it("returns pro limits for pro subscription", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const { getSubscriptionByUserId, getEffectivePlan } = await import("../db");
      vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
        id: "sub_123",
        plan: "pro",
        status: "active",
      });
      vi.mocked(getEffectivePlan).mockResolvedValueOnce("pro");

      const result = await caller.payment.getCurrentPlan();

      expect(result.plan).toBe("pro");
      expect(result.limits.maxScansPerDay).toBe(Infinity);
      expect(result.limits.complianceExport).toBe(true);
    });
  });
});

describe("payments webhook security", () => {
  it("rejects webhook without signature", async () => {
    const { verifyWebhookSignature } = await import("../payments");
    vi.mocked(verifyWebhookSignature).mockReturnValueOnce(false);

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {}, ip: "127.0.0.1" },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.payment.handleWebhook({ event: "subscription.activated", payload: {} }),
    ).rejects.toThrow(/Invalid webhook signature/i);
  });

  it("rejects webhook with invalid signature", async () => {
    const { verifyWebhookSignature } = await import("../payments");
    vi.mocked(verifyWebhookSignature).mockReturnValueOnce(false);

    const ctx = {
      user: null,
      req: {
        protocol: "https",
        headers: { "x-razorpay-signature": "invalid_sig" },
        ip: "127.0.0.1",
      },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.payment.handleWebhook({ event: "subscription.activated", payload: {} }),
    ).rejects.toThrow(/Invalid webhook signature/i);
  });

  it("accepts valid webhook signature", async () => {
    const { verifyWebhookSignature, handleWebhookEvent } = await import("../payments");
    vi.mocked(verifyWebhookSignature).mockReturnValueOnce(true);
    vi.mocked(handleWebhookEvent).mockReturnValueOnce({
      event: "subscription.activated",
      subscriptionId: "sub_test_123",
      data: { payload: {} },
    });

    const ctx = {
      user: null,
      req: {
        protocol: "https",
        headers: { "x-razorpay-signature": "valid_sig" },
        ip: "127.0.0.1",
      },
      res: { clearCookie: vi.fn() },
    } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);

    const result = await caller.payment.handleWebhook({
      event: "subscription.activated",
      payload: { subscription: { entity: { id: "sub_test_123" } } },
    });

    expect(result).toEqual({ received: true });
  });
});
