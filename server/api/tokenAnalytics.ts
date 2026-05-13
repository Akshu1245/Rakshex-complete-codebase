import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import {
  bytesPerTokenForFileType,
  estimateCostForContent,
} from "../utils/tokenEstimation";
import { toNumber } from "../utils/decimal";

export const tokenAnalyticsRouter = router({
  recordUsage: protectedProcedure
    .input(
      z.object({
        model: z.string().min(1).max(128),
        promptTokens: z.number().int().min(0),
        completionTokens: z.number().int().min(0),
        thinkingTokens: z.number().int().min(0),
        costUSD: z.number().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.recordTokenUsage(
        ctx.user.id,
        input.model,
        input.promptTokens,
        input.completionTokens,
        input.thinkingTokens,
        input.costUSD
      );
      return { success: true };
    }),

  getAnalytics: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).optional() }))
    .query(async ({ input, ctx }) => {
      const usage = await db.getTokenUsageByUserId(
        ctx.user.id,
        input.days || 30
      );

      const byModel: Record<string, any> = {};
      let totalCost = 0;
      let totalTokens = 0;

      for (const record of usage) {
        if (!byModel[record.model]) {
          byModel[record.model] = {
            model: record.model,
            promptTokens: 0,
            completionTokens: 0,
            thinkingTokens: 0,
            totalTokens: 0,
            costUSD: 0,
          };
        }

        byModel[record.model].promptTokens += record.promptTokens;
        byModel[record.model].completionTokens += record.completionTokens;
        byModel[record.model].thinkingTokens += record.thinkingTokens;
        byModel[record.model].totalTokens += record.totalTokens;
        const cost = toNumber(record.costUSD);
        byModel[record.model].costUSD += cost;

        totalCost += cost;
        totalTokens += record.totalTokens;
      }

      return {
        byModel: Object.values(byModel),
        totalTokens,
        totalCost,
        usage: usage.map(u => ({
          date: u.date,
          model: u.model,
          tokens: u.totalTokens,
          cost: toNumber(u.costUSD),
        })),
      };
    }),

  getModelBreakdown: protectedProcedure
    .input(z.object({ model: z.string() }))
    .query(async ({ input, ctx }) => {
      const usage = await db.getTokenUsageByModel(ctx.user.id, input.model);

      return {
        model: input.model,
        usage: usage.map(u => ({
          date: u.date,
          promptTokens: u.promptTokens,
          completionTokens: u.completionTokens,
          thinkingTokens: u.thinkingTokens,
          totalTokens: u.totalTokens,
          costUSD: toNumber(u.costUSD),
        })),
      };
    }),

  /**
   * Content-aware cost estimate. Given a chunk of text plus an optional file
   * type hint (e.g. "json", "ts", "md"), returns a token count and USD cost.
   * Pattern adapted from Claude Code's tokenEstimation: JSON payloads tokenize
   * at ~2 bytes/token vs. prose at ~4, so a flat ratio systematically
   * underestimates cost for API-scan-heavy users.
   */
  estimateCost: protectedProcedure
    .input(
      z.object({
        content: z.string().max(2_000_000),
        fileExtension: z.string().max(32).optional(),
        pricePer1MTokens: z.number().min(0).default(3),
      })
    )
    .query(({ input }) => {
      const { tokens, costUSD } = estimateCostForContent(
        input.content,
        input.pricePer1MTokens,
        input.fileExtension
      );
      return {
        tokens,
        costUSD,
        bytesPerTokenUsed: input.fileExtension
          ? bytesPerTokenForFileType(input.fileExtension)
          : 4,
      };
    }),

  exportAnalytics: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).optional() }))
    .mutation(async ({ input, ctx }) => {
      const usage = await db.getTokenUsageByUserId(
        ctx.user.id,
        input.days || 30
      );

      const csvHeader =
        "Date,Model,Prompt Tokens,Completion Tokens,Thinking Tokens,Total Tokens,Cost (USD)";
      const csvRows = usage.map(
        u =>
          `${new Date(u.date).toISOString()},${u.model},${u.promptTokens},${u.completionTokens},${u.thinkingTokens},${u.totalTokens},${toNumber(u.costUSD).toFixed(6)}`
      );
      const csv = [csvHeader, ...csvRows].join("\n");

      const totalCost = usage.reduce(
        (sum, u) => sum + toNumber(u.costUSD),
        0
      );
      const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);

      return {
        csv,
        totalCost,
        totalTokens,
        recordCount: usage.length,
        exportDate: new Date().toISOString(),
      };
    }),
});
