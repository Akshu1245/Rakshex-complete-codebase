import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import * as appDb from "../db";
import { scanReports } from "@rakshex/database";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireCollectionAccess } from "../services/tenantAccess";

function scoreFromFindings(rows: Array<{ severity: string }>): number {
  const weights: Record<string, number> = {
    Critical: 25,
    High: 15,
    Medium: 8,
    Low: 3,
  };
  const penalty = rows.reduce((sum, row) => sum + (weights[row.severity] ?? 5), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export const reportsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        scanId: z.string().min(1).max(64),
        expiresInDays: z.number().int().min(1).max(90).default(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const database = await appDb.getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const scan = await appDb.getScanById(input.scanId);
      if (!scan || scan.status !== "completed") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Completed scan not found" });
      }
      const { collection, workspaceId } = await requireCollectionAccess(
        scan.collectionId,
        ctx.user.id,
        "collections",
        "read",
        ctx.user.name,
      );
      const rows = await appDb.getFindingsByScanId(input.scanId);
      const findings = rows.slice(0, 500).map((finding) => ({
        title: finding.title,
        severity: finding.severity,
        endpoint: finding.endpoint ?? "unknown",
        description: finding.description ?? undefined,
        remediation: finding.remediation ?? undefined,
      }));
      const endpoints = Array.from(
        new Set(findings.map((finding) => finding.endpoint).filter(Boolean)),
      ).slice(0, 250);
      const reportId = nanoid(24);
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

      await database.insert(scanReports).values({
        id: reportId,
        ownerUserId: ctx.user.id,
        workspaceId,
        scanId: input.scanId,
        score: scoreFromFindings(findings),
        findings,
        filename: collection.name,
        endpoints,
        expiresAt,
      });

      return {
        reportId,
        url: `${process.env.APP_URL || "https://rakshex.in"}/report/${reportId}`,
        expiresAt,
      };
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const database = await appDb.getDb();
    if (!database) return [];
    return database
      .select({
        id: scanReports.id,
        score: scanReports.score,
        findingCount: sql<number>`json_array_length(${scanReports.findings})`,
        filename: scanReports.filename,
        createdAt: scanReports.createdAt,
        expiresAt: scanReports.expiresAt,
        revokedAt: scanReports.revokedAt,
        viewCount: scanReports.viewCount,
      })
      .from(scanReports)
      .where(eq(scanReports.ownerUserId, ctx.user.id))
      .orderBy(desc(scanReports.createdAt))
      .limit(50);
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().min(16).max(32) }))
    .mutation(async ({ input, ctx }) => {
      const database = await appDb.getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }
      const [row] = await database
        .update(scanReports)
        .set({ revokedAt: new Date() })
        .where(and(eq(scanReports.id, input.id), eq(scanReports.ownerUserId, ctx.user.id)))
        .returning({ id: scanReports.id });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      return { ok: true };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().min(16).max(32) }))
    .query(async ({ input }) => {
      const database = await appDb.getDb();
      if (!database) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      const [report] = await database
        .select({
          id: scanReports.id,
          score: scanReports.score,
          findings: scanReports.findings,
          filename: scanReports.filename,
          endpoints: scanReports.endpoints,
          createdAt: scanReports.createdAt,
          expiresAt: scanReports.expiresAt,
          viewCount: scanReports.viewCount,
        })
        .from(scanReports)
        .where(
          and(
            eq(scanReports.id, input.id),
            isNull(scanReports.revokedAt),
            gt(scanReports.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!report) return null;

      await database
        .update(scanReports)
        .set({ viewCount: sql`${scanReports.viewCount} + 1` })
        .where(eq(scanReports.id, input.id));

      return { ...report, viewCount: report.viewCount + 1 };
    }),
});
