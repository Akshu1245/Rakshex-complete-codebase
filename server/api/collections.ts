import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../_core/trpc";
import * as db from "../db";
import { getOrSetCache, CACHE_TTL, cacheKeys, invalidateUserCache } from "../_core/cache";
import { getPlanLimits } from "../payments";
import { collectionLimitError } from "../utils/planLimits";
import { toNumber } from "../utils/decimal";
import { scanCollectionForCredentials } from "../services/collectionCredentialScan";
import { scanCollectionForGateway } from "../services/gatewayCollectionScan";
import { parseBrunoCollection } from "../services/brunoImport";
import { logger } from "../_core/logger";
import { logSecurityEvent } from "../services/securityEvents";

/** Reject keys that could enable prototype pollution */
function hasPollutionKeys(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const keys = Object.keys(value);
  if (keys.some((k) => k === "__proto__" || k === "constructor" || k === "prototype")) {
    return true;
  }
  return Object.values(value).some((v) => hasPollutionKeys(v));
}

const MAX_COLLECTION_DATA_BYTES = 1_024 * 1_024; // 1 MB

function checkDataSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

export const collectionsRouter = router({
  create: editorProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        format: z.enum(["postman", "openapi", "bruno"]),
        data: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.data || typeof input.data !== "object") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid collection data: must be a JSON object",
        });
      }
      if (hasPollutionKeys(input.data)) {
        logSecurityEvent(
          "prototype_pollution_blocked",
          { keys: Object.keys(input.data) },
          {
            userId: ctx.user.id,
            ip: ctx.req.ip,
            userAgent: ctx.req.headers["user-agent"] as string,
          },
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Collection data contains prohibited keys",
        });
      }

      const dataSize = checkDataSize(input.data);
      if (dataSize > MAX_COLLECTION_DATA_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Collection data exceeds ${MAX_COLLECTION_DATA_BYTES / (1024 * 1024)}MB limit`,
        });
      }

      // Plan-limit enforcement: free users are capped at `maxCollections`.
      // Existing collections above the cap are grandfathered — we only
      // block NEW creation. Pro / Enterprise resolve to Infinity.
      // Throws a structured `plan_limit` TRPCError (see utils/planLimits.ts).
      const plan = (ctx.user.plan ?? "free") as "free" | "pro" | "enterprise";
      const limits = getPlanLimits(plan);
      if (Number.isFinite(limits.maxCollections)) {
        const existing = await db.getCollectionsByUserId(ctx.user.id);
        if (existing.length >= limits.maxCollections) {
          throw collectionLimitError(plan, existing.length, limits.maxCollections);
        }
      }

      // Normalize Bruno collections to internal format before scanning
      let collectionData = input.data;
      if (input.format === "bruno") {
        try {
          const brunoResult = parseBrunoCollection(JSON.stringify(input.data));
          collectionData = {
            info: {
              name: brunoResult.name,
              schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            },
            item: brunoResult.requests.map((r) => ({
              name: r.name,
              request: {
                method: r.method,
                url: { raw: r.url },
                header: Object.entries(r.headers).map(([key, value]) => ({ key, value })),
                body: r.body ? { mode: "raw", raw: r.body } : undefined,
              },
            })),
            _brunoImport: { warnings: brunoResult.warnings },
          };
          if (brunoResult.warnings.length > 0) {
            logger.warn(
              { userId: ctx.user.id, warnings: brunoResult.warnings },
              "[Collections] Bruno import warnings",
            );
          }
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid Bruno collection: ${(err as Error).message}`,
          });
        }
      }

      // Patent surface NHCE/DEV/2026/001 component: every imported collection
      // is run through the credential scanner before persistence so leaked
      // keys are surfaced at import time rather than 30,000 collections later.
      const credentialFindings = scanCollectionForCredentials(collectionData);

      // Gateway scan: check endpoints for prompt-injection patterns, PII
      // exposure, and missing auth headers — surfaces LLM-specific risks
      // at import time before any API code hits production.
      let gatewayFindings: Array<{
        endpoint: string;
        method: string;
        category: string;
        severity: string;
        description: string;
        remediation: string;
        sample: string;
      }> = [];
      try {
        const gwResult = scanCollectionForGateway(collectionData);
        gatewayFindings = gwResult.findings.map((f) => ({
          endpoint: f.endpoint,
          method: f.method,
          category: f.category,
          severity: f.severity,
          description: f.description,
          remediation: f.remediation,
          sample: f.sample,
        }));
        if (gatewayFindings.length > 0) {
          logger.warn(
            { userId: ctx.user.id, count: gatewayFindings.length },
            "[Collections] gateway scan found LLM-specific issues at import",
          );
        }
      } catch (err) {
        logger.warn({ err }, "[Collections] gateway scan skipped — non-blocking");
      }

      const collection = await db.createCollection(
        ctx.user.id,
        input.name,
        input.format,
        collectionData,
        input.description,
      );
      if (credentialFindings.length > 0) {
        logger.warn(
          {
            userId: ctx.user.id,
            collectionId: collection.id,
            count: credentialFindings.length,
            ruleIds: Array.from(new Set(credentialFindings.map((f) => f.ruleId))),
          },
          "[Collections] credential scanner detected potential leaks at import",
        );
      }
      await invalidateUserCache(ctx.user.id);
      return {
        ...collection,
        credentialFindings: credentialFindings.map((f) => ({
          ruleId: f.ruleId,
          description: f.description,
          severity: f.severity,
          path: f.path,
          matchPreview: f.matchPreview,
          line: f.line,
        })),
        gatewayFindings,
      };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const cacheKey = cacheKeys.userCollections(ctx.user.id);

      const allCollections = await getOrSetCache(cacheKey, CACHE_TTL.USER_COLLECTIONS, () =>
        db.getCollectionsByUserId(ctx.user.id),
      );

      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const total = allCollections.length;
      const paginated = allCollections.slice((page - 1) * pageSize, page * pageSize);
      return {
        collections: paginated.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          format: c.format,
          totalRequests: c.totalRequests,
          createdAt: c.createdAt,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const collection = await db.getCollectionById(input.id);
    if (!collection || collection.userId !== ctx.user.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collection not found or access denied",
      });
    }
    return collection;
  }),

  delete: editorProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const collection = await db.getCollectionById(input.id);
    if (!collection || collection.userId !== ctx.user.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collection not found or access denied",
      });
    }
    await db.deleteCollection(input.id);
    return { success: true };
  }),

  update: editorProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.id);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }
      await db.updateCollection(input.id, {
        name: input.name,
        description: input.description,
      });
      return { success: true };
    }),

  getWithDetails: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.id);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }

      const [scans, recentFindings, shadowApis, complianceReports] = await Promise.all([
        db.getScansByCollectionId(input.id),
        db.getFindingsByScanId((await db.getScansByCollectionId(input.id))[0]?.id || ""),
        db.getShadowAPIsByCollectionId(input.id),
        db.getComplianceReportsByCollectionId(input.id),
      ]);

      const lastScan = scans.length > 0 ? scans[0] : null;
      const totalFindings = scans.reduce((sum, scan) => sum + (scan.totalFindings || 0), 0);

      return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        format: collection.format,
        totalRequests: collection.totalRequests,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        lastScanDate: lastScan?.completedAt || lastScan?.createdAt || null,
        totalScans: scans.length,
        totalFindings,
        recentFindings: recentFindings.slice(0, 10).map((f) => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          status: f.status,
          createdAt: f.createdAt,
        })),
        shadowApis: shadowApis.map((s) => ({
          id: s.id,
          endpoint: s.endpoint,
          method: s.method,
          riskLevel: s.riskLevel,
          isDocumented: s.isDocumented,
          createdAt: s.createdAt,
        })),
        complianceReports: complianceReports.map((r) => ({
          id: r.id,
          reportType: r.reportType,
          complianceScore: toNumber(r.complianceScore),
          totalRequirements: r.totalRequirements,
          metRequirements: r.metRequirements,
          createdAt: r.createdAt,
        })),
      };
    }),
});
