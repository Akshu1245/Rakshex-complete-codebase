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
import {
  parseCollectionImport,
  MAX_IMPORT_BYTES,
  SAFE_SAMPLE_COLLECTIONS,
} from "../services/collectionImport/secureParse";
import { assertWorkspacePermission } from "../services/authorization";
import { requireCollectionAccess, resolveCallerWorkspace } from "../services/tenantAccess";

/** Reject keys that could enable prototype pollution */
function hasPollutionKeys(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const keys = Object.keys(value);
  if (keys.some((k) => k === "__proto__" || k === "constructor" || k === "prototype")) {
    return true;
  }
  return Object.values(value).some((v) => hasPollutionKeys(v));
}

const MAX_COLLECTION_DATA_BYTES = MAX_IMPORT_BYTES;

function checkDataSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

export const collectionsRouter = router({
  /** Safe sample payloads for demos (no real secrets). */
  samples: protectedProcedure.query(() => SAFE_SAMPLE_COLLECTIONS),

  create: editorProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        format: z.enum(["postman", "openapi", "bruno"]),
        data: z.record(z.unknown()),
        /** Optional raw text for YAML path (server-side secure parse). */
        rawText: z
          .string()
          .max(MAX_IMPORT_BYTES * 2)
          .optional(),
        tags: z.array(z.string().max(64)).max(32).optional(),
        allowDuplicate: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const workspace = await resolveCallerWorkspace(ctx.user.id, ctx.user.name);
      await assertWorkspacePermission(workspace.id, ctx.user.id, "collections", "write");

      // Prefer secure parse when rawText provided or _rawYaml wrapper present
      let collectionData: Record<string, unknown> = input.data as Record<string, unknown>;
      let storageFormat = input.format;
      let contentHash: string | undefined;
      let tags = input.tags ?? [];
      let endpointCount: number | undefined;
      let importWarnings: string[] = [];
      let secretsRedacted = 0;
      let detectedFormat: string | undefined;

      if (input.rawText || (input.data as any)?._rawYaml) {
        const raw =
          input.rawText ??
          (typeof (input.data as any)._rawYaml === "string"
            ? (input.data as any)._rawYaml
            : JSON.stringify(input.data));
        const parsed = parseCollectionImport(raw, {
          filename: input.name + (input.rawText?.includes("openapi:") ? ".yaml" : ".json"),
          forceYaml: Boolean((input.data as any)?._rawYaml) || input.format === "openapi",
        });
        if (parsed.errors.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: parsed.errors.join("; "),
          });
        }
        collectionData = parsed.data;
        storageFormat = parsed.storageFormat;
        contentHash = parsed.contentHash;
        tags = [...new Set([...(input.tags ?? []), ...parsed.tags])];
        endpointCount = parsed.endpointCount;
        importWarnings = parsed.warnings;
        secretsRedacted = parsed.secretsRedacted;
        detectedFormat = parsed.format;
      } else {
        if (!input.data || typeof input.data !== "object") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid collection data: must be a JSON object",
          });
        }
        // Run secure pipeline on JSON objects too (refs + secrets + depth)
        const parsed = parseCollectionImport(JSON.stringify(input.data), {
          filename: `${input.name}.json`,
        });
        if (parsed.errors.length === 0 && Object.keys(parsed.data).length > 0) {
          collectionData = parsed.data;
          contentHash = parsed.contentHash;
          tags = [...new Set([...(input.tags ?? []), ...parsed.tags])];
          endpointCount = parsed.endpointCount;
          importWarnings = parsed.warnings;
          secretsRedacted = parsed.secretsRedacted;
          detectedFormat = parsed.format;
          if (parsed.storageFormat !== "bruno") storageFormat = parsed.storageFormat;
        }
      }

      if (hasPollutionKeys(collectionData)) {
        logSecurityEvent(
          "prototype_pollution_blocked",
          { keys: Object.keys(collectionData) },
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

      const dataSize = checkDataSize(collectionData);
      if (dataSize > MAX_COLLECTION_DATA_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Collection data exceeds ${MAX_COLLECTION_DATA_BYTES / (1024 * 1024)}MB limit`,
        });
      }

      // Duplicate detection by content hash
      if (contentHash && !input.allowDuplicate) {
        const dup = await db.findCollectionByContentHash(ctx.user.id, contentHash);
        if (dup) {
          return {
            id: dup.id,
            userId: dup.userId,
            name: dup.name,
            format: dup.format,
            totalRequests: dup.totalRequests,
            duplicate: true,
            contentHash,
            importWarnings: ["Duplicate collection content detected; returning existing record"],
            secretsRedacted: 0,
            credentialFindings: [],
            gatewayFindings: [],
          };
        }
      }

      // Plan-limit enforcement
      const plan = (ctx.user.plan ?? "free") as "free" | "pro" | "enterprise";
      const limits = getPlanLimits(plan);
      if (Number.isFinite(limits.maxCollections)) {
        const existing = await db.getCollectionsByUserId(ctx.user.id);
        if (existing.length >= limits.maxCollections) {
          throw collectionLimitError(plan, existing.length, limits.maxCollections);
        }
      }

      if (storageFormat === "bruno" || input.format === "bruno") {
        try {
          const brunoResult = parseBrunoCollection(JSON.stringify(collectionData));
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
          storageFormat = "postman";
          if (brunoResult.warnings.length > 0) {
            importWarnings.push(...brunoResult.warnings);
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
        storageFormat,
        collectionData,
        input.description,
        {
          contentHash,
          tags,
          version: 1,
          totalRequests: endpointCount,
          workspaceId: workspace.id,
        },
      );

      // Version history — always scoped to the caller's workspace (never workspaceId: 0)
      if (contentHash) {
        try {
          await db.saveCollectionVersion({
            workspaceId: workspace.id,
            collectionId: collection.id,
            version: 1,
            format: detectedFormat ?? storageFormat,
            contentHash,
            data: collectionData,
            createdByUserId: ctx.user.id,
          });
        } catch (err) {
          logger.warn({ err }, "[Collections] version persist skipped");
        }
      }

      // Onboarding truth: import is a real event
      try {
        await db.updateOnboardingStep(ctx.user.id, "importCollection");
      } catch (err) {
        logger.warn({ err }, "[Collections] onboarding step update skipped");
      }

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
        contentHash,
        tags,
        version: 1,
        detectedFormat,
        secretsRedacted,
        importWarnings,
        duplicate: false,
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
          cursor: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const workspace = await resolveCallerWorkspace(ctx.user.id, ctx.user.name);
      await assertWorkspacePermission(workspace.id, ctx.user.id, "collections", "read");

      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const limit = input?.limit ?? pageSize;
      // Prefer page offset; cursor remains offset-compatible for older clients.
      const offset = input?.page != null ? (page - 1) * pageSize : (input?.cursor ?? 0);

      const cacheKey = `${cacheKeys.userCollections(ctx.user.id)}:ws:${workspace.id}:o:${offset}:l:${limit}`;

      const { items, total } = await getOrSetCache(cacheKey, CACHE_TTL.USER_COLLECTIONS, () =>
        db.listCollectionsPage({
          workspaceId: workspace.id,
          userId: ctx.user.id,
          limit,
          offset,
        }),
      );

      const mapRow = (c: (typeof items)[number]) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        format: c.format,
        totalRequests: c.totalRequests,
        createdAt: c.createdAt,
      });

      const mapped = items.map(mapRow);
      const hasMore = offset + mapped.length < total;

      return {
        collections: mapped,
        items: mapped,
        nextCursor: hasMore ? offset + limit : undefined,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 0,
      };
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const { collection } = await requireCollectionAccess(
      input.id,
      ctx.user.id,
      "collections",
      "read",
      ctx.user.name,
    );
    return collection;
  }),

  delete: editorProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    await requireCollectionAccess(input.id, ctx.user.id, "collections", "delete", ctx.user.name);
    await db.deleteCollection(input.id);
    await invalidateUserCache(ctx.user.id);
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
      await requireCollectionAccess(input.id, ctx.user.id, "collections", "write", ctx.user.name);
      await db.updateCollection(input.id, {
        name: input.name,
        description: input.description,
      });
      await invalidateUserCache(ctx.user.id);
      return { success: true };
    }),

  getWithDetails: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const { collection } = await requireCollectionAccess(
        input.id,
        ctx.user.id,
        "collections",
        "read",
        ctx.user.name,
      );

      const [scans, shadowApis, complianceReports] = await Promise.all([
        db.getScansByCollectionId(input.id),
        db.getShadowAPIsByCollectionId(input.id),
        db.getComplianceReportsByCollectionId(input.id),
      ]);

      const lastScan = scans.length > 0 ? scans[0] : null;
      const recentFindings = lastScan?.id ? await db.getFindingsByScanId(lastScan.id) : [];
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
