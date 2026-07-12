/**
 * Public Report API — share scan results without authentication.
 *
 * Anyone with the link can view the report. No sign-up required.
 * This is the viral loop: user scans → finds issues → shares link →
 * viewer sees value → signs up to scan their own APIs.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import * as db from "../db";

export const publicReportsRouter = router({
  /**
   * Get a public scan report by scan ID.
   * No authentication required — the scan ID acts as an unguessable token.
   */
  getByScanId: publicProcedure
    .input(z.object({ scanId: z.string().min(1) }))
    .query(async ({ input }) => {
      const scan = await db.getScanById(input.scanId);
      if (!scan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found",
        });
      }

      // Only show completed scans
      if (scan.status !== "completed") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not available yet — scan is still running",
        });
      }

      const findings = await db.getFindingsByScanId(input.scanId);
      const collection = await db.getCollectionById(scan.collectionId);

      // Sanitize: strip user IDs, internal fields
      const severityCount = {
        Critical: findings.filter((f) => f.severity === "Critical").length,
        High: findings.filter((f) => f.severity === "High").length,
        Medium: findings.filter((f) => f.severity === "Medium").length,
        Low: findings.filter((f) => f.severity === "Low").length,
      };

      return {
        scan: {
          id: scan.id,
          scanType: scan.scanType,
          riskScore: scan.riskScore,
          riskLevel: scan.riskLevel,
          totalFindings: scan.totalFindings,
          completedAt: scan.completedAt,
        },
        collection: collection
          ? {
              name: collection.name,
              format: collection.format,
              totalRequests: collection.totalRequests ?? 0,
            }
          : null,
        findings: findings.map((f) => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          category: f.category,
          description: f.description,
          remediation: f.remediation,
          cweId: f.cweId,
        })),
        severityCount,
        meta: {
          generatedAt: new Date().toISOString(),
          tool: "RaksHex Security Scan",
          version: "1.0.0",
        },
      };
    }),
});
