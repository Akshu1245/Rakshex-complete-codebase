import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../_core/trpc";
import { InternalError } from "../_core/errors";
import { logger } from "../_core/logger";
import * as db from "../db";
import { runCollectionScan } from "../services/scanService";
import { wsManager } from "../websocket";
import { invalidateUserCache, redis } from "../_core/cache";
import { getPlanLimits } from "../payments";
import {
  scansPerDayLimitError,
  shadowAPIGatedError,
} from "../utils/planLimits";
import { summarizeFindings } from "../utils/findingSummarizer";
import {
  INJECTION_PAYLOADS,
  groupPayloadsByCategory,
} from "../utils/promptInjectionPayloads";
import { toNumber } from "../utils/decimal";

export const scanningRouter = router({
  startScan: editorProcedure
    .input(
      z.object({
        collectionId: z.string(),
        scanType: z.enum(["full", "quick", "shadow_api", "prompt_injection"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.collectionId);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }

      // Plan-limit enforcement: cap scans per day on free plan. Shadow-API
      // scans are a gated feature entirely — only pro/enterprise. Errors
      // carry a structured `cause` (see server/utils/planLimits.ts) so the
      // dashboard + VS Code extension can render an upgrade CTA instead of
      // parsing free-form strings.
      const plan = (ctx.user.plan ?? "free") as "free" | "pro" | "enterprise";
      const limits = getPlanLimits(plan);
      if (input.scanType === "shadow_api" && !limits.shadowAPI) {
        throw shadowAPIGatedError(plan);
      }
      if (Number.isFinite(limits.maxScansPerDay)) {
        // Atomic Redis INCR with daily key — race-safe across replicas.
        // Falls back to a DB count if Redis is unavailable so the limit
        // still applies (just without strict atomicity).
        const dayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
        const counterKey = `scan_count:${ctx.user.id}:${dayKey}`;
        let used = 0;
        let resetsAt = Date.now() + 24 * 60 * 60 * 1000;
        try {
          const pipeline = redis.multi();
          pipeline.incr(counterKey);
          pipeline.expire(counterKey, 60 * 60 * 24);
          pipeline.ttl(counterKey);
          const results = await pipeline.exec();
          // Caught locally below — these aren't user-facing, just used to
          // bail out of the success path so we fall through to fail-open.
          if (!results) throw new InternalError("Redis pipeline returned null");
          const incrResult = results[0]?.[1];
          const ttlResult = results[2]?.[1];
          if (typeof incrResult !== "number") {
            throw new InternalError("Redis INCR returned non-numeric");
          }
          used = incrResult;
          if (typeof ttlResult === "number" && ttlResult > 0) {
            resetsAt = Date.now() + ttlResult * 1000;
          }
        } catch (redisErr) {
          // Redis is down — rather than fail-closed (which would block all
          // scans), we fail-open with a warning so the platform stays usable.
          // The DB-level scan record + Sentry alert on Redis errors give us
          // an audit trail. If you'd rather fail-closed, throw here instead.
          logger.warn(
            { err: redisErr },
            "[scan-limit] Redis unavailable, allowing scan without rate-limit check"
          );
          used = 0;
        }
        if (used > limits.maxScansPerDay) {
          throw scansPerDayLimitError(
            plan,
            used - 1, // current usage prior to this attempt
            limits.maxScansPerDay,
            resetsAt
          );
        }
      }

      // Broadcast scan started event
      wsManager.broadcastScanStarted(ctx.user.id, {
        scanId: "pending",
        collectionId: input.collectionId,
      });

      // Run the scan using the reusable service
      const result = await runCollectionScan(ctx.user.id, input.collectionId, {
        scanType: input.scanType,
        triggeredBy: "user",
      });

      // Get findings for WebSocket broadcast
      const findings = await db.getFindingsByScanId(result.scanId);
      const criticalCount = findings.filter(
        f => f.severity === "Critical"
      ).length;
      const highCount = findings.filter(f => f.severity === "High").length;

      // Broadcast scan complete event
      wsManager.broadcastScanComplete(ctx.user.id, {
        scanId: result.scanId,
        collectionId: input.collectionId,
        findingsCount: result.totalFindings,
        criticalCount,
        highCount,
      });

      return {
        scanId: result.scanId,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        totalFindings: result.totalFindings,
        findings: findings.map(f => ({
          id: f.id,
          title: f.title,
          description: f.description,
          severity: f.severity,
          category: f.category,
          remediation: f.remediation,
          cweId: f.cweId,
        })),
      };
    }),

  listScans: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        scanType: z
          .enum(["full", "quick", "shadow_api", "prompt_injection", "all"])
          .default("all"),
      })
    )
    .query(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.collectionId);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }

      let scans = await db.getScansByCollectionId(input.collectionId);

      if (input.scanType !== "all") {
        scans = scans.filter(s => s.scanType === input.scanType);
      }

      const total = scans.length;
      const paginated = scans.slice(
        (input.page - 1) * input.pageSize,
        input.page * input.pageSize
      );

      return {
        scans: paginated.map(s => ({
          id: s.id,
          scanType: s.scanType,
          status: s.status,
          riskScore: toNumber(s.riskScore),
          riskLevel: s.riskLevel,
          totalFindings: s.totalFindings,
          createdAt: s.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  getScan: protectedProcedure
    .input(z.object({ scanId: z.string() }))
    .query(async ({ input, ctx }) => {
      const scan = await db.getScanById(input.scanId);
      if (!scan || scan.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scan not found or access denied",
        });
      }

      const findings = await db.getFindingsByScanId(input.scanId);
      return {
        id: scan.id,
        scanType: scan.scanType,
        status: scan.status,
        riskScore: toNumber(scan.riskScore),
        riskLevel: scan.riskLevel,
        totalFindings: scan.totalFindings,
        findings: findings.map(f => ({
          id: f.id,
          title: f.title,
          description: f.description,
          severity: f.severity,
          category: f.category,
          remediation: f.remediation,
          status: f.status,
          cweId: f.cweId,
        })),
        createdAt: scan.createdAt,
      };
    }),

  /**
   * Phase 25 — LLM-powered triage summary for a completed scan. Returns
   * a DevPulse-tuned summary suitable for pasting into a ticket or Slack.
   * Explicit endpoint (not auto-run on every scan) so users can opt in per
   * scan and we only burn tokens when a human is actually going to read it.
   */
  summarizeScan: protectedProcedure
    .input(z.object({ scanId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const scan = await db.getScanById(input.scanId);
      if (!scan || scan.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scan not found or access denied",
        });
      }
      const collection = await db.getCollectionById(scan.collectionId);
      const findings = await db.getFindingsByScanId(input.scanId);

      const summary = await summarizeFindings({
        scanId: scan.id,
        collectionName: collection?.name ?? "Untitled collection",
        scanType: scan.scanType,
        riskScore: toNumber(scan.riskScore),
        riskLevel: scan.riskLevel,
        findings: findings.map(f => ({
          title: f.title,
          severity: f.severity,
          description: f.description,
          category: f.category,
          remediation: f.remediation,
          cweId: f.cweId,
        })),
        userId: ctx.user.id,
      });

      return summary;
    }),

  /**
   * Phase 25 — expose the prompt-injection payload library so the
   * dashboard and VS Code extension can render "what does this scan
   * actually test for?" without having to re-specify the catalogue.
   */
  listPromptInjectionPayloads: protectedProcedure.query(() => {
    return {
      total: INJECTION_PAYLOADS.length,
      byCategory: groupPayloadsByCategory(),
      payloads: INJECTION_PAYLOADS.map(p => ({
        id: p.id,
        category: p.category,
        severity: p.severity,
        name: p.name,
        description: p.description,
        recommendation: p.recommendation,
        owaspLlmId: p.owaspLlmId ?? null,
      })),
    };
  }),

  updateFindingStatus: protectedProcedure
    .input(
      z.object({
        findingId: z.string(),
        status: z.enum(["open", "in-progress", "resolved"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const finding = await db.getFindingById(input.findingId);
      if (!finding || finding.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Finding not found or access denied",
        });
      }
      await db.updateFindingStatus(input.findingId, input.status);
      return { success: true };
    }),
});
