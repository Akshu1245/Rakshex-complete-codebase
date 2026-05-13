/**
 * tRPC router exposing the Unified Risk Score engine.
 *
 * Patent surface NHCE/DEV/2026/001. Stateless: callers provide the
 * security/cost inputs and receive a normalised combined score back. The
 * frontend can use this to render a top-N riskiest-endpoints panel without
 * the server having to know how to attribute spend to endpoints (which is
 * a separate, evolving piece).
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  computeUnifiedRiskScore,
  rankByUnifiedRisk,
  unifiedRiskInputSchema,
} from "../services/unifiedRiskScore";

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
      })
    )
    .query(({ input }) => ({
      ranked: rankByUnifiedRisk(input.endpoints),
      total: input.endpoints.length,
    })),
});
