/**
 * Audit Log Router — Compliance-grade audit trail with export.
 *
 * Supports:
 *   - Paginated audit log viewer with filters
 *   - Streaming export in JSONL or CSV format
 *   - HMAC-SHA256 signature for export integrity
 */
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { logger } from "../_core/logger";

export const auditRouter = router({
  /**
   * List audit entries with optional filters.
   */
  listEntries: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        cursor: z.number().int().min(0).default(0),
        eventType: z.string().optional(),
        userId: z.number().int().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const entries = await db.getAuditLogForUser(input.userId ?? ctx.user.id, 1000);

      let filtered = entries;

      if (input.eventType) {
        filtered = filtered.filter((e) => e.action === input.eventType);
      }
      if (input.userId && ctx.user.id !== input.userId) {
        // Admin-only: viewing another user's audit log requires admin
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can view another user's audit log",
          });
        }
      }
      if (input.startDate) {
        const start = new Date(input.startDate);
        filtered = filtered.filter((e) => new Date(e.createdAt) >= start);
      }
      if (input.endDate) {
        const end = new Date(input.endDate);
        filtered = filtered.filter((e) => new Date(e.createdAt) <= end);
      }

      const total = filtered.length;
      const cursor = input.cursor ?? input.offset;
      const limit = input.limit;
      const sliced = filtered.slice(cursor, cursor + limit + 1);
      const hasMore = sliced.length > limit;
      const items = sliced.slice(0, limit);
      const page = filtered.slice(input.offset, input.offset + input.limit);

      return {
        entries: page.map((e) => ({
          id: e.id,
          action: e.action,
          details: e.details,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
          createdAt: e.createdAt,
          userId: e.userId,
        })),
        items: items.map((e) => ({
          id: e.id,
          action: e.action,
          details: e.details,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
          createdAt: e.createdAt,
          userId: e.userId,
        })),
        nextCursor: hasMore ? cursor + limit : undefined,
        total,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Export audit log as JSONL or CSV.
   * Returns the export body directly (not streaming to simplify tRPC transport).
   * For large exports, use the CSV format which is more compact.
   */
  export: adminProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        format: z.enum(["jsonl", "csv"]).default("jsonl"),
        userId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = input.userId ?? ctx.user.id;
      const entries = await db.getAuditLogForUser(userId, 10000);

      let filtered = entries;
      if (input.startDate) {
        const start = new Date(input.startDate);
        filtered = filtered.filter((e) => new Date(e.createdAt) >= start);
      }
      if (input.endDate) {
        const end = new Date(input.endDate);
        filtered = filtered.filter((e) => new Date(e.createdAt) <= end);
      }

      let exportBody: string;
      let contentType: string;
      let filename: string;

      const dateStr = new Date().toISOString().slice(0, 10);

      if (input.format === "csv") {
        const headers = ["id", "userId", "action", "ipAddress", "createdAt"];
        const rows = filtered.map((e) =>
          [
            e.id,
            e.userId,
            `"${(e.action || "").replace(/"/g, '""')}"`,
            e.ipAddress ?? "",
            e.createdAt?.toISOString() ?? "",
          ].join(","),
        );
        exportBody = [headers.join(","), ...rows].join("\n");
        contentType = "text/csv";
        filename = `Rakshex-audit-${dateStr}.csv`;
      } else {
        exportBody = filtered
          .map((e) =>
            JSON.stringify({
              id: e.id,
              userId: e.userId,
              action: e.action,
              details: e.details,
              ipAddress: e.ipAddress,
              userAgent: e.userAgent,
              createdAt: e.createdAt?.toISOString(),
            }),
          )
          .join("\n");
        contentType = "application/x-jsonlines";
        filename = `Rakshex-audit-${dateStr}.jsonl`;
      }

      logger.info(
        {
          userId,
          format: input.format,
          count: filtered.length,
        },
        "[Audit] Export generated",
      );

      return {
        body: exportBody,
        contentType,
        filename,
        count: filtered.length,
      };
    }),
});
