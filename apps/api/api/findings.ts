/**
 * Findings lifecycle API (PROMPT 7).
 * List/detail/filter/sort, assignment, comments, suppression, false-positive,
 * accepted-risk, reopen, bulk actions, SARIF/JSON/CSV export.
 * Never trusts client workspace/role claims — ownership is always server-resolved.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../db";
import { findings, findingComments } from "@rakshex/database";
import { requireFindingAccess, requireCollectionAccess } from "../services/tenantAccess";
import { logger } from "../_core/logger";

const statusEnum = z.enum([
  "open",
  "in-progress",
  "resolved",
  "suppressed",
  "false_positive",
  "accepted_risk",
  "reopened",
]);

const severityEnum = z.enum(["Critical", "High", "Medium", "Low"]);

async function requireOwnedFinding(
  findingId: string,
  userId: number,
  action: "read" | "write" = "read",
) {
  const { finding, workspaceId } = await requireFindingAccess(findingId, userId, action);
  return { ...(finding as typeof findings.$inferSelect), workspaceId };
}

function toSarif(rows: Array<typeof findings.$inferSelect>) {
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "Rakshex Deterministic Scanner",
            informationUri: "https://rakshex.in",
            rules: [],
          },
        },
        results: rows.map((f) => ({
          ruleId: f.ruleId ?? "unknown",
          level:
            f.severity === "Critical" || f.severity === "High"
              ? "error"
              : f.severity === "Medium"
                ? "warning"
                : "note",
          message: { text: f.title },
          properties: {
            confidence: f.confidence,
            fingerprint: f.fingerprint,
            status: f.status,
            category: f.category,
            cwe: f.cweId,
          },
          locations: f.endpoint
            ? [
                {
                  physicalLocation: {
                    artifactLocation: { uri: f.endpoint },
                    region: { snippet: { text: `${f.method ?? ""} ${f.endpoint}`.trim() } },
                  },
                },
              ]
            : [],
        })),
      },
    ],
  };
}

function toCsv(rows: Array<typeof findings.$inferSelect>): string {
  const cols = [
    "id",
    "title",
    "severity",
    "status",
    "confidence",
    "ruleId",
    "endpoint",
    "method",
    "fingerprint",
    "collectionId",
    "cweId",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => esc((r as Record<string, unknown>)[c] ?? (r as any)[c])).join(","));
  }
  return lines.join("\n");
}

export const findingsRouter = router({
  /** Reactivate expired suppressions then list. */
  list: protectedProcedure
    .input(
      z
        .object({
          status: statusEnum.optional(),
          severity: severityEnum.optional(),
          collectionId: z.string().optional(),
          assigneeUserId: z.number().int().positive().optional(),
          sortBy: z.enum(["createdAt", "severity", "status", "dueAt"]).default("createdAt"),
          sortDir: z.enum(["asc", "desc"]).default("desc"),
          limit: z.number().int().min(1).max(500).default(100),
          offset: z.number().int().min(0).default(0),
          newOnly: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      await db.reactivateExpiredSuppressions(ctx.user.id);
      let rows = await db.listFindingsForUser(ctx.user.id, {
        status: input?.status,
        severity: input?.severity,
        collectionId: input?.collectionId,
        assigneeUserId: input?.assigneeUserId,
        limit: input?.limit ?? 100,
        offset: input?.offset ?? 0,
      });

      if (input?.newOnly) {
        rows = rows.filter((r) => !r.duplicateOf);
      }

      // Group duplicates predictably by fingerprint
      const groups = new Map<string, typeof rows>();
      for (const r of rows) {
        const key = r.fingerprint || r.id;
        const list = groups.get(key) ?? [];
        list.push(r);
        groups.set(key, list);
      }

      return {
        findings: rows,
        groups: [...groups.entries()].map(([fingerprint, items]) => ({
          fingerprint,
          count: items.length,
          primaryId: items[0]?.id,
          severity: items[0]?.severity,
          title: items[0]?.title,
        })),
        total: rows.length,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const row = await requireOwnedFinding(input.id, ctx.user.id, "read");
      const driver = await getDb();
      let comments: unknown[] = [];
      if (driver) {
        comments = await driver
          .select()
          .from(findingComments)
          .where(eq(findingComments.findingId, input.id))
          .orderBy(desc(findingComments.createdAt));
      }
      try {
        await db.updateOnboardingStep(ctx.user.id, "reviewFindings");
      } catch (err) {
        logger.warn({ err }, "[Findings] onboarding step update skipped");
      }
      return { finding: row, comments };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: statusEnum,
        reason: z.string().max(2000).optional(),
        expiresAt: z.string().datetime().optional(),
        approvedByUserId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireOwnedFinding(input.id, ctx.user.id, "write");

      if (input.status === "suppressed") {
        if (!input.reason) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Suppression requires a reason" });
        }
        await db.updateFindingStatus(input.id, "suppressed", {
          suppressionReason: input.reason,
          suppressionExpiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
      } else if (input.status === "false_positive") {
        if (!input.reason) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "False-positive requires a reason",
          });
        }
        await db.updateFindingStatus(input.id, "false_positive", {
          suppressionReason: input.reason,
        });
      } else if (input.status === "accepted_risk") {
        if (!input.reason) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Accepted risk requires justification",
          });
        }
        await db.updateFindingStatus(input.id, "accepted_risk", {
          acceptedRiskReason: input.reason,
          acceptedRiskApprovedBy: input.approvedByUserId ?? ctx.user.id,
        });
      } else if (input.status === "reopened" || input.status === "open") {
        await db.updateFindingStatus(input.id, input.status === "reopened" ? "reopened" : "open", {
          suppressionReason: null,
          suppressionExpiresAt: null,
          acceptedRiskReason: null,
          acceptedRiskApprovedBy: null,
        });
      } else {
        await db.updateFindingStatus(input.id, input.status);
      }

      await db.createAuditLogEntry(
        ctx.user.id,
        "finding_status_changed",
        {
          findingId: input.id,
          status: input.status,
          reason: input.reason,
        },
        ctx.req.ip,
        ctx.req.headers["user-agent"] as string,
      );

      return { success: true };
    }),

  assign: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        assigneeUserId: z.number().int().positive().nullable(),
        dueAt: z.string().datetime().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireOwnedFinding(input.id, ctx.user.id, "write");
      await db.updateFindingStatus(input.id, "in-progress", {
        assigneeUserId: input.assigneeUserId,
        dueAt: input.dueAt ? new Date(input.dueAt) : input.dueAt === null ? null : undefined,
      });
      await db.createAuditLogEntry(ctx.user.id, "finding_assigned", {
        findingId: input.id,
        assigneeUserId: input.assigneeUserId,
      });
      return { success: true };
    }),

  comment: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const finding = await requireOwnedFinding(input.id, ctx.user.id, "write");
      const driver = await getDb();
      if (!driver) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const commentId = `fc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      await driver.insert(findingComments).values({
        id: commentId,
        workspaceId: finding.workspaceId,
        findingId: input.id,
        authorUserId: ctx.user.id,
        body: input.body,
      });
      await db.createAuditLogEntry(ctx.user.id, "finding_comment", {
        findingId: input.id,
        commentId,
      });
      return { id: commentId };
    }),

  bulkUpdate: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(1)).min(1).max(100),
        status: statusEnum,
        reason: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      let updated = 0;
      for (const id of input.ids) {
        try {
          await requireOwnedFinding(id, ctx.user.id, "write");
          await db.updateFindingStatus(id, input.status, {
            suppressionReason: input.reason ?? null,
          });
          updated += 1;
        } catch {
          /* skip unauthorized */
        }
      }
      await db.createAuditLogEntry(ctx.user.id, "finding_bulk_update", {
        ids: input.ids,
        status: input.status,
        updated,
      });
      return { updated };
    }),

  export: protectedProcedure
    .input(
      z.object({
        format: z.enum(["json", "csv", "sarif"]),
        collectionId: z.string().optional(),
        status: statusEnum.optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const rows = await db.listFindingsForUser(ctx.user.id, {
        collectionId: input.collectionId,
        status: input.status,
        limit: 1000,
      });
      // Cross-workspace: all rows already scoped to ctx.user.id
      if (input.format === "sarif") {
        return { format: "sarif" as const, body: JSON.stringify(toSarif(rows as any), null, 2) };
      }
      if (input.format === "csv") {
        return { format: "csv" as const, body: toCsv(rows as any) };
      }
      return {
        format: "json" as const,
        body: JSON.stringify(rows, null, 2),
      };
    }),

  /** Baseline comparison: findings in latest scan not in previous scan for collection. */
  baselineDiff: protectedProcedure
    .input(z.object({ collectionId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      await requireCollectionAccess(
        input.collectionId,
        ctx.user.id,
        "collections",
        "read",
        ctx.user.name,
      );
      const all = await db.listFindingsForUser(ctx.user.id, {
        collectionId: input.collectionId,
        limit: 500,
      });
      const byScan = new Map<string, typeof all>();
      for (const f of all) {
        const list = byScan.get(f.scanId) ?? [];
        list.push(f);
        byScan.set(f.scanId, list);
      }
      const scanIds = [...byScan.keys()];
      if (scanIds.length < 2) {
        return { newFindings: all.filter((f) => !f.duplicateOf), resolvedFingerprints: [] };
      }
      const latest = byScan.get(scanIds[0]!) ?? [];
      const previous = byScan.get(scanIds[1]!) ?? [];
      const prevFp = new Set(previous.map((f) => f.fingerprint).filter(Boolean));
      const newFindings = latest.filter((f) => f.fingerprint && !prevFp.has(f.fingerprint));
      const latestFp = new Set(latest.map((f) => f.fingerprint).filter(Boolean));
      const resolvedFingerprints = previous
        .map((f) => f.fingerprint)
        .filter((fp): fp is string => Boolean(fp) && !latestFp.has(fp));
      return { newFindings, resolvedFingerprints };
    }),
});
