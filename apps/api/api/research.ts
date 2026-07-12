/**
 * Research API Router — tRPC endpoints for research, competitive intelligence,
 * and market analysis.
 *
 * Exposes: runResearch, listMemory, searchMemory, scanCompetitor,
 * scanAllCompetitors, getCompetitiveScans, getMarketTrends
 */

import { z } from "zod";
import { router, protectedProcedure, editorProcedure, adminProcedure } from "../_core/trpc";
import { executeResearch, enqueueResearchJob } from "../services/research/orchestrator";
import { scanCompetitor, scanAllCompetitors } from "../services/research/competitiveWatch";
import * as researchDb from "../services/research/db";
import { logger } from "../_core/logger";

export const researchRouter = router({
  // ── Research ──────────────────────────────────────────────────────────

  runResearch: editorProcedure
    .input(
      z.object({
        topic: z.string().min(1).max(200),
        searchQueries: z.array(z.string().min(1)).min(1).max(10),
        specificUrls: z.array(z.string().url()).optional(),
        depth: z.enum(["quick", "standard", "deep"]).default("standard"),
        maxSources: z.number().int().min(1).max(50).default(15),
        includeCompetitors: z.boolean().default(false),
        includeTrends: z.boolean().default(false),
        async: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (input.async) {
        const jobId = await enqueueResearchJob({
          topic: input.topic,
          searchQueries: input.searchQueries,
          specificUrls: input.specificUrls,
          depth: input.depth,
          maxSources: input.maxSources,
          includeCompetitors: input.includeCompetitors,
          includeTrends: input.includeTrends,
          userId: ctx.user.id,
        });
        return { jobId, status: "queued" };
      }

      // Synchronous execution
      const report = await executeResearch({
        topic: input.topic,
        searchQueries: input.searchQueries,
        specificUrls: input.specificUrls,
        depth: input.depth,
        maxSources: input.maxSources,
        includeCompetitors: input.includeCompetitors,
        includeTrends: input.includeTrends,
        userId: ctx.user.id,
      });

      return { report, status: "completed" };
    }),

  listMemory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      return researchDb.getResearchMemory(ctx.user.id, input.limit, input.offset);
    }),

  searchMemory: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      return researchDb.searchResearchMemory(ctx.user.id, input.query, input.limit);
    }),

  // ── Competitive Intelligence ──────────────────────────────────────────

  scanCompetitor: editorProcedure
    .input(
      z.object({
        competitorId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await scanCompetitor(input.competitorId);
      return result;
    }),

  scanAllCompetitors: adminProcedure.mutation(async () => {
    const results = await scanAllCompetitors();
    return { count: results.length, results };
  }),

  getCompetitiveScans: protectedProcedure
    .input(
      z.object({
        competitorId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(10),
      }),
    )
    .query(async ({ input }) => {
      if (input.competitorId) {
        return researchDb.getCompetitiveScanHistory(input.competitorId, input.limit);
      }

      const { DEFAULT_COMPETITORS } = await import("../services/research/competitiveWatch");
      const results: Record<string, unknown> = {};
      for (const c of DEFAULT_COMPETITORS.slice(0, 6)) {
        results[c.id] = await researchDb.getLatestCompetitiveScan(c.id);
      }
      return results;
    }),

  // ── Market Trends ─────────────────────────────────────────────────────

  getMarketTrends: protectedProcedure
    .input(
      z.object({
        domain: z.string().min(1).max(200),
        timeRangeDays: z.number().int().min(1).max(90).default(30),
        maxItems: z.number().int().min(5).max(100).default(25),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const report = await executeResearch({
        topic: `Market trends: ${input.domain}`,
        searchQueries: [
          `${input.domain} industry trends ${new Date().getFullYear()}`,
          `${input.domain} market analysis growth forecast`,
          `${input.domain} technology innovation disruption`,
          `${input.domain} funding investment startups`,
        ],
        depth: "standard",
        maxSources: input.maxItems,
        includeCompetitors: false,
        includeTrends: true,
        userId: ctx.user.id,
      });

      return report;
    }),
});
