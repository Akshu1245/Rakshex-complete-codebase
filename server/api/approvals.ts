/**
 * Approvals Router — Manage pending approvals for policy-blocked events.
 */
import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../_core/logger";

export const approvalsRouter = router({
  /**
   * List pending approvals for the current workspace.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected"]).default("pending"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const dbClient = await db.getDb();
      if (!dbClient) return { approvals: [], total: 0 };

      const rows = await dbClient.execute(
        sql`SELECT * FROM pending_approvals WHERE workspace_id = ${`ws_${ctx.user.id}`} AND status = ${input.status} ORDER BY requested_at DESC LIMIT ${input.limit} OFFSET ${input.offset}`,
      );

      const countResult = await dbClient.execute(
        sql`SELECT COUNT(*) as total FROM pending_approvals WHERE workspace_id = ${`ws_${ctx.user.id}`} AND status = ${input.status}`,
      );

      return {
        approvals: (rows as unknown as any[]).map((r: any) => ({
          approvalId: r.approval_id,
          ruleId: r.rule_id,
          eventSnapshot: r.event_snapshot,
          status: r.status,
          requestedAt: r.requested_at,
          resolvedAt: r.resolved_at,
        })),
        total: (countResult as unknown as any[])[0]?.total ?? 0,
      };
    }),

  /**
   * Approve a pending request.
   */
  approve: adminProcedure
    .input(
      z.object({
        approvalId: z.string(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const dbClient = await db.getDb();
      if (!dbClient)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await dbClient.execute(
        sql`UPDATE pending_approvals SET status = 'approved', resolved_at = NOW(), resolved_by = ${ctx.user.id}, resolution_note = ${input.note ?? ""} WHERE approval_id = ${input.approvalId}`,
      );

      logger.info({ approvalId: input.approvalId, userId: ctx.user.id }, "[Approvals] Approved");

      return { success: true };
    }),

  /**
   * Reject a pending request.
   */
  reject: adminProcedure
    .input(
      z.object({
        approvalId: z.string(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const dbClient = await db.getDb();
      if (!dbClient)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await dbClient.execute(sql`
        UPDATE pending_approvals
        SET status = 'rejected', resolved_at = NOW(), resolved_by = ${ctx.user.id}, resolution_note = ${input.note ?? ""}
        WHERE approval_id = ${input.approvalId}
      `);

      logger.info({ approvalId: input.approvalId, userId: ctx.user.id }, "[Approvals] Rejected");

      return { success: true };
    }),
});
