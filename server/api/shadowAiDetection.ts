/**
 * Shadow AI Detection tRPC Router.
 *
 * Exposes the egress-log-based shadow AI detection for the dashboard.
 * Customers push egress logs via the internal endpoint
 * (POST /api/internal/shadow-ai-events) and this router lets them
 * view/discover/acknowledge detected rogue LLM traffic.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const shadowAiDetectionRouter = router({
  /** List recent shadow AI discoveries for the current user. */
  getEvents: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await db.getShadowAiEvents(
        ctx.user.id,
        input.limit,
        input.severity
      );
      return events;
    }),

  /** Get a single shadow AI event by id. */
  getEvent: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const event = await db.getShadowAiEventById(ctx.user.id, input.id);
      if (!event) throw new Error("Shadow AI event not found");
      return event;
    }),

  /** Get a summary count by severity. */
  summary: protectedProcedure.query(async ({ ctx }) => {
    return db.getShadowAiSummary(ctx.user.id);
  }),
});
