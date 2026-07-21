import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../_core/trpc";
import { InternalError } from "../_core/errors";
import { logger } from "../_core/logger";
import * as db from "../db";
import { scanQueue } from "../queues";
import type { ScanJobData } from "../queues/workers/scanWorker";
import { wsManager } from "../websocket";
import { invalidateUserCache, redis } from "../_core/cache";
import { getPlanLimits } from "../payments";
import { scansPerDayLimitError, shadowAPIGatedError } from "../utils/planLimits";
import { summarizeFindings } from "../utils/findingSummarizer";
import { createNotification } from "./notifications";
import { INJECTION_PAYLOADS, groupPayloadsByCategory } from "../utils/promptInjectionPayloads";
import { toNumber } from "../utils/decimal";
import { requireCollectionAccess, requireFindingAccess } from "../services/tenantAccess";

// In-memory fallback for scan rate limiting when Redis is down
const scanFallbackCounters = new Map<string, { count: number; expiresAt: number }>();

function getFallbackScanCount(userId: number, dayKey: string): number {
  const key = `${userId}:${dayKey}`;
  const entry = scanFallbackCounters.get(key);
  const now = Date.now();
  if (!entry || now > entry.expiresAt) {
    scanFallbackCounters.set(key, { count: 1, expiresAt: now + 24 * 60 * 60 * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

export const scanningRouter = router({
  startScan: editorProcedure
    .input(
      z.object({
        collectionId: z.string(),
        scanType: z.enum(["full", "quick", "shadow_api", "prompt_injection"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { collection, workspaceId } = await requireCollectionAccess(
        input.collectionId,
        ctx.user.id,
        "collections",
        "write",
        ctx.user.name,
      );

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
        let used: number;
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
          // Redis is down — use in-memory fallback instead of fail-open.
          // This maintains rate-limiting (without cross-replica consistency)
          // rather than completely disabling the limit.
          logger.warn(
            { err: redisErr },
            "[scan-limit] Redis unavailable, falling back to in-memory rate limit",
          );
          used = getFallbackScanCount(ctx.user.id, dayKey);
        }
        if (used > limits.maxScansPerDay) {
          throw scansPerDayLimitError(
            plan,
            used - 1, // current usage prior to this attempt
            limits.maxScansPerDay,
            resetsAt,
          );
        }
      }

      // Broadcast scan started event
      wsManager.broadcastScanStarted(ctx.user.id, {
        scanId: "pending",
        collectionId: input.collectionId,
      });

      // Enqueue the scan instead of running synchronously
      const scanJobData: ScanJobData = {
        userId: ctx.user.id,
        collectionId: input.collectionId,
        scanType: input.scanType,
        engineType: input.scanType === "prompt_injection" ? "agentguard" : "full",
        workspaceId,
      };
      const job = await scanQueue.add("scan", scanJobData);

      logger.info(
        { jobId: job.id, collectionId: input.collectionId, workspaceId },
        "[Scanning] Scan enqueued",
      );

      try {
        await db.updateOnboardingStep(ctx.user.id, "runScan");
      } catch (err) {
        logger.warn({ err }, "[Scanning] onboarding step update skipped");
      }

      await createNotification({
        userId: ctx.user.id,
        type: "scan_complete",
        title: "Scan queued",
        body: `Your ${input.scanType.replace("_", " ")} scan of "${collection.name}" has been queued and will begin shortly.`,
        link: "/scans",
      });

      return {
        scanId: job.id ?? "queued",
        status: "queued",
        message: "Scan has been queued and will begin shortly.",
      };
    }),

  /**
   * Poll for the status of a queued scan.
   */
  getScanStatus: protectedProcedure
    .input(
      z.object({
        scanId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const job = await scanQueue.getJob(input.scanId);
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scan job not found",
        });
      }
      const state = await job.getState();
      return {
        jobId: job.id,
        state,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        data: job.data,
      };
    }),

  listScans: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        scanType: z.enum(["full", "quick", "shadow_api", "prompt_injection", "all"]).default("all"),
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

      let scans = await db.getScansByCollectionId(input.collectionId);

      if (input.scanType !== "all") {
        scans = scans.filter((s) => s.scanType === input.scanType);
      }

      const total = scans.length;
      const paginated = scans.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);

      return {
        scans: paginated.map((s) => ({
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
        findings: findings.map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
          severity: f.severity,
          category: f.category,
          remediation: f.remediation,
          status: f.status,
          cweId: f.cweId,
          ruleId: (f as any).ruleId,
          confidence: (f as any).confidence,
          fingerprint: (f as any).fingerprint,
          endpoint: (f as any).endpoint,
          method: (f as any).method,
          evidence: (f as any).evidence,
        })),
        createdAt: scan.createdAt,
      };
    }),

  /** Cancel a queued/active BullMQ scan job. */
  cancelScan: editorProcedure
    .input(z.object({ scanId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const job = await scanQueue.getJob(input.scanId);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scan job not found" });
      }
      if (job.data.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your scan" });
      }
      const state = await job.getState();
      if (state === "completed" || state === "failed") {
        return { success: false, state, message: "Job already finished" };
      }
      await job.remove();
      await db.createAuditLogEntry(ctx.user.id, "scan_cancelled", { scanId: input.scanId });
      return { success: true, state: "cancelled" };
    }),

  /**
   * Phase 25 — LLM-powered triage summary for a completed scan. Returns
   * a Rakshex-tuned summary suitable for pasting into a ticket or Slack.
   * Explicit endpoint (not auto-run on every scan) so users can opt in per
   * scan and we only burn tokens when a human is actually going to read it.
   */
  summarizeScan: protectedProcedure
    .input(z.object({ scanId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const scan = await db.getScanById(input.scanId);
      if (!scan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scan not found or access denied",
        });
      }
      await requireCollectionAccess(
        scan.collectionId,
        ctx.user.id,
        "collections",
        "read",
        ctx.user.name,
      );
      const collection = await db.getCollectionById(scan.collectionId);
      const findings = await db.getFindingsByScanId(input.scanId);

      const summary = await summarizeFindings({
        scanId: scan.id,
        collectionName: collection?.name ?? "Untitled collection",
        scanType: scan.scanType,
        riskScore: toNumber(scan.riskScore),
        riskLevel: scan.riskLevel,
        findings: findings.map((f) => ({
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
      payloads: INJECTION_PAYLOADS.map((p) => ({
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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await requireFindingAccess(input.findingId, ctx.user.id, "write");
      await db.updateFindingStatus(input.findingId, input.status);
      return { success: true };
    }),
});
