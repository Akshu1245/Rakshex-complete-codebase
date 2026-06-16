/**
 * SOC2 evidence-collection tRPC router.
 *
 * Two endpoints:
 *  - `evidencePack`: build a deterministic JSON evidence pack for a
 *    custom (or default 90-day) window. Returned shape is consumable by
 *    Vanta / Drata import APIs and by a human auditor.
 *  - `auditLogExport`: export the gateway audit log over a window as
 *    CSV-friendly rows for direct hand-off.
 *
 * Both endpoints are tenant-scoped via `protectedProcedure` — there is
 * no cross-tenant evidence leak surface.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { buildEvidencePack, defaultWindow, SOC_TWO_CONTROLS } from "../services/socTwoEvidence";

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "must be a valid ISO date",
});

export const socTwoRouter = router({
  /**
   * List the controls the platform attests to. Useful for the "what is
   * covered" page in the dashboard and for Vanta/Drata to map their
   * own control catalogue against ours.
   */
  controls: protectedProcedure.query(async () => {
    return { controls: SOC_TWO_CONTROLS };
  }),

  /**
   * Build a tenant-scoped evidence pack over a custom or default window.
   */
  evidencePack: protectedProcedure
    .input(
      z
        .object({
          windowStart: isoDate.optional(),
          windowEnd: isoDate.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const def = defaultWindow(now);
      const windowStart = input?.windowStart ? new Date(input.windowStart) : def.windowStart;
      const windowEnd = input?.windowEnd ? new Date(input.windowEnd) : def.windowEnd;

      const [audit, runs, shadow] = await Promise.all([
        db.getGatewayAuditRecent(ctx.user.id, 10000),
        db.listRedteamRuns(ctx.user.id, 200),
        db.listShadowAiEvents(ctx.user.id, 2000),
      ]);

      return buildEvidencePack(
        {
          tenantId: ctx.user.id,
          windowStart,
          windowEnd,
          audit,
          redteamRuns: runs,
          shadowEvents: shadow,
        },
        now,
      );
    }),

  /**
   * Export the gateway audit log over a window. Returns up to 5000 rows
   * (auditors typically request samples; full export goes through a
   * separate background-job pathway when scoped to year-long windows).
   */
  auditLogExport: protectedProcedure
    .input(
      z.object({
        windowStart: isoDate.optional(),
        windowEnd: isoDate.optional(),
        limit: z.number().int().min(1).max(5000).default(1000),
      }),
    )
    .query(async ({ ctx, input }) => {
      const def = defaultWindow();
      const start = input.windowStart ? new Date(input.windowStart) : def.windowStart;
      const end = input.windowEnd ? new Date(input.windowEnd) : def.windowEnd;

      const audit = await db.getGatewayAuditRecent(ctx.user.id, input.limit);
      const inWindow = audit.filter((r) => r.createdAt >= start && r.createdAt <= end);

      return {
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        count: inWindow.length,
        rows: inWindow.map((r) => ({
          id: r.id,
          requestId: r.requestId,
          provider: r.provider,
          model: r.model,
          decision: r.decision,
          blockReason: r.blockReason,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          totalTokens: r.totalTokens,
          estimatedCostUsd: r.estimatedCostUsd.toString(),
          latencyMs: r.latencyMs,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    }),
});
