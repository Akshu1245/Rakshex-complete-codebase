import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const costRouter = router({
  breakdown: protectedProcedure.query(async ({ ctx }) => {
    const usage = await db.getTokenUsageByUserId(ctx.user.id, 30);
    const total = usage.reduce((s: number, u: any) => s + (u.costUsd || 0), 0);
    return { totalCost: total, usage };
  }),

  summary: protectedProcedure.query(async ({ ctx }) => {
    const usage = await db.getTokenUsageByUserId(ctx.user.id, 14);
    const weeklyTotal = usage.reduce((s: number, u: any) => s + (u.costUsd || 0), 0);
    return { dailySpend: usage, weeklyTotal };
  }),

  setBudget: protectedProcedure
    .input(z.object({ dailyCapUsd: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      await db.setTokenBudget(ctx.user.id, input.dailyCapUsd, "hard");
      return { success: true, dailyCapUsd: input.dailyCapUsd };
    }),
});
