import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import * as db from "../db";
import { processRefund } from "../payments";

export const adminRouter = router({
  listAllUsers: adminProcedure.query(async () => {
    const users = await db.getAllUsers();
    return { users };
  }),

  listAllWaitlist: adminProcedure.query(async () => {
    const entries = await db.getAllWaitlistEntries();
    return { entries };
  }),

  processRefund: adminProcedure
    .input(
      z.object({
        paymentId: z.string(),
        amount: z.number().optional(),
        reason: z.string().default("Admin initiated refund"),
      }),
    )
    .mutation(async ({ input }) => {
      const payment = await db.getPaymentByRazorpayId(input.paymentId);
      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found",
        });
      }

      const refundAmount = input.amount || parseFloat(payment.amount as string) * 100;

      const result = await processRefund(input.paymentId, refundAmount, input.reason);

      await db.updatePaymentRefundStatus(
        input.paymentId,
        refundAmount / 100,
        input.amount ? "partial" : "full",
      );

      return result;
    }),

  getSystemStats: adminProcedure.query(async () => {
    const allUsers = await db.getAllUsers();
    const activeUsers = allUsers.filter(
      (u: any) =>
        u.lastSignedIn &&
        new Date(u.lastSignedIn) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
    const proUsers = allUsers.filter((u: any) => u.plan === "pro" || u.plan === "enterprise");

    return {
      totalUsers: allUsers.length,
      activeUsers30d: activeUsers.length,
      proUsers: proUsers.length,
      freeUsers: allUsers.length - proUsers.length,
    };
  }),

  changeUserPlan: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        plan: z.enum(["free", "pro", "enterprise"]),
      }),
    )
    .mutation(async ({ input }) => {
      await db.updateUserPlan(input.userId, input.plan);
      return { success: true };
    }),
});
