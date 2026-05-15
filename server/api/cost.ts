import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq, desc, sql } from "drizzle-orm";
import { llmUsage, apiEndpoints, findings } from "@/db/schema";

export const costRouter = router({
  // 🔥 NEW: Cost breakdown per endpoint for cost revelation
  breakdown: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get total cost for last 30 days
    const totalResult = await ctx.db
      .select({ total: sql<number>`COALESCE(SUM(${llmUsage.costUsd}), 0)` })
      .from(llmUsage)
      .where(eq(llmUsage.userId, userId));

    const totalCost = totalResult[0]?.total || 0;

    // Get per-endpoint breakdown
    const endpointCosts = await ctx.db
      .select({
        endpoint: llmUsage.endpoint,
        cost: sql<number>`COALESCE(SUM(${llmUsage.costUsd}), 0)`,
        tokens: sql<number>`COALESCE(SUM(${llmUsage.totalTokens}), 0)`,
        model: llmUsage.model,
      })
      .from(llmUsage)
      .where(eq(llmUsage.userId, userId))
      .groupBy(llmUsage.endpoint, llmUsage.model)
      .orderBy(desc(sql`SUM(${llmUsage.costUsd})`))
      .limit(10);

    // Calculate percentages and detect anomalies
    const topEndpoints = endpointCosts.map((ep) => ({
      endpoint: ep.endpoint || "unknown",
      cost: Number(ep.cost),
      percentage: totalCost > 0 ? Math.round((Number(ep.cost) / totalCost) * 100) : 0,
      model: ep.model || "unknown",
      tokens: Number(ep.tokens),
    }));

    // Detect anomalies (endpoints with >50% increase vs previous week)
    const anomalies = await detectCostAnomalies(ctx.db, userId);

    return {
      totalCost,
      topEndpoints,
      anomalies,
      period: "30d",
    };
  }),

  // Get cost trends over time
  trends: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const trends = await ctx.db
        .select({
          date: sql<string>`DATE(${llmUsage.createdAt})`,
          cost: sql<number>`COALESCE(SUM(${llmUsage.costUsd}), 0)`,
          tokens: sql<number>`COALESCE(SUM(${llmUsage.totalTokens}), 0)`,
        })
        .from(llmUsage)
        .where(eq(llmUsage.userId, userId))
        .groupBy(sql`DATE(${llmUsage.createdAt})`)
        .orderBy(sql`DATE(${llmUsage.createdAt})`)
        .limit(input.days);

      return trends;
    }),

  // Get thinking token costs separately
  thinkingTokens: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const thinkingCosts = await ctx.db
      .select({
        endpoint: llmUsage.endpoint,
        thinkingTokens: sql<number>`COALESCE(SUM(${llmUsage.thinkingTokens}), 0)`,
        thinkingCost: sql<number>`COALESCE(SUM(${llmUsage.thinkingCostUsd}), 0)`,
      })
      .from(llmUsage)
      .where(eq(llmUsage.userId, userId))
      .groupBy(llmUsage.endpoint)
      .orderBy(desc(sql`SUM(${llmUsage.thinkingCostUsd})`));

    return thinkingCosts;
  }),
});

// Helper: Detect cost anomalies
async function detectCostAnomalies(db: any, userId: string) {
  // Compare last 24h vs previous 24h
  const recent = await db
    .select({ cost: sql<number>`COALESCE(SUM(${llmUsage.costUsd}), 0)` })
    .from(llmUsage)
    .where(
      sql`${llmUsage.userId} = ${userId} AND ${llmUsage.createdAt} >= NOW() - INTERVAL '24 hours'`
    );

  const previous = await db
    .select({ cost: sql<number>`COALESCE(SUM(${llmUsage.costUsd}), 0)` })
    .from(llmUsage)
    .where(
      sql`${llmUsage.userId} = ${userId} AND ${llmUsage.createdAt} >= NOW() - INTERVAL '48 hours' AND ${llmUsage.createdAt} < NOW() - INTERVAL '24 hours'`
    );

  const recentCost = Number(recent[0]?.cost || 0);
  const previousCost = Number(previous[0]?.cost || 0);

  if (previousCost > 0 && (recentCost - previousCost) / previousCost > 0.5) {
    // Find which endpoint caused the spike
    const spikeEndpoint = await db
      .select({
        endpoint: llmUsage.endpoint,
        cost: sql<number>`COALESCE(SUM(${llmUsage.costUsd}), 0)`,
      })
      .from(llmUsage)
      .where(
        sql`${llmUsage.userId} = ${userId} AND ${llmUsage.createdAt} >= NOW() - INTERVAL '24 hours'`
      )
      .groupBy(llmUsage.endpoint)
      .orderBy(desc(sql`SUM(${llmUsage.costUsd})`))
      .limit(1);

    return [{
      endpoint: spikeEndpoint[0]?.endpoint || "unknown",
      description: `Cost increased ${Math.round(((recentCost - previousCost) / previousCost) * 100)}% vs yesterday`,
      currentCost: recentCost,
      projectedCost: recentCost * 30, // Project to monthly
      percentageIncrease: Math.round(((recentCost - previousCost) / previousCost) * 100),
      recommendation: "Check for runaway loops or excessive reasoning token usage",
    }];
  }

  return [];
}
