/**
 * tRPC router exposing the Unified Risk Score engine.
 *
 * Stateless: callers provide the
 * security/cost inputs and receive a normalised combined score back. The
 * frontend can use this to render a top-N riskiest-endpoints panel without
 * the server having to know how to attribute spend to endpoints (which is
 * a separate, evolving piece).
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { requireCollectionAccess } from "../services/tenantAccess";
import { toNumber } from "../utils/decimal";
import {
  computeUnifiedRiskScore,
  rankByUnifiedRisk,
  unifiedRiskInputSchema,
  type Severity,
} from "../services/unifiedRiskScore";

const SEVERITY_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const RANK_TO_SEVERITY: Severity[] = ["None", "Low", "Medium", "High", "Critical"];

export const riskScoreRouter = router({
  /** Compute the combined score for one endpoint. */
  compute: protectedProcedure
    .input(unifiedRiskInputSchema)
    .query(({ input }) => computeUnifiedRiskScore(input)),

  /**
   * Compute and rank scores for many endpoints. Capped at 500 to keep this
   * predictable for the IDE / dashboard surfaces.
   */
  rank: protectedProcedure
    .input(
      z.object({
        endpoints: z.array(unifiedRiskInputSchema).min(1).max(500),
      }),
    )
    .query(({ input }) => ({
      ranked: rankByUnifiedRisk(input.endpoints),
      total: input.endpoints.length,
    })),

  /**
   * Data-backed unified score for a whole collection. Fuses the collection's
   * open-finding security posture with the caller's LLM cost anomaly (current
   * 7-day spend vs. the trailing weekly-equivalent baseline) using the same
   * combined-score engine — so the "security + cost" number is auto-computed
   * from real product data instead of being supplied by the client.
   */
  forCollection: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        windowDays: z.number().int().min(7).max(90).default(30),
      }),
    )
    .query(async ({ input, ctx }) => {
      await requireCollectionAccess(
        input.collectionId,
        ctx.user.id,
        "collections",
        "read",
        ctx.user.name,
      );

      // Security leg: highest severity + count across open findings.
      const findings = await db.listFindingsForUser(ctx.user.id, {
        collectionId: input.collectionId,
        status: "open",
        limit: 500,
      });
      const highestRank = findings.reduce(
        (acc, f) => Math.max(acc, SEVERITY_RANK[f.severity as string] ?? 0),
        0,
      );
      const highestSeverity = RANK_TO_SEVERITY[highestRank];

      // Cost leg: current 7-day spend vs. trailing weekly-equivalent baseline.
      const usage = await db.getTokenUsageByUserId(ctx.user.id, input.windowDays);
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      let currentSpendUsd = 0;
      let priorSpendUsd = 0;
      for (const u of usage) {
        const cost = toNumber((u as { costUSD?: string | number }).costUSD ?? 0);
        const ts = new Date((u as { date?: string | Date }).date ?? now).getTime();
        if (now - ts <= sevenDaysMs) currentSpendUsd += cost;
        else priorSpendUsd += cost;
      }
      const priorDays = Math.max(1, input.windowDays - 7);
      const baselineSpendUsd = (priorSpendUsd / priorDays) * 7; // weekly-equivalent baseline

      return computeUnifiedRiskScore({
        endpointId: input.collectionId,
        highestSeverity,
        openFindings: findings.length,
        currentSpendUsd,
        baselineSpendUsd,
      });
    }),
});
