/**
 * Data-export tRPC router (Sprint 6 / Domain 3).
 *
 * Single, generic export surface for tabular tenant data. Each resource is
 * mapped to a row-builder that reuses existing DB helpers. The format
 * (`json` / `ndjson` / `csv` / `pdf`) is decided by the caller; the actual
 * encoding lives in `services/dataExport.ts`.
 *
 * Two modes:
 *  - `inline`: returns the export body in the tRPC response. Useful for
 *    small results the dashboard can offer as an immediate download.
 *  - `streaming`: returns metadata + a one-time download token. The caller
 *    GETs `/api/internal/data-export/<token>` to stream the body. Future
 *    work hooks this into S3 signed URLs (out of scope for this sprint —
 *    needs S3 creds, which we don't ship in unit tests).
 *
 * Authorization: every resource builder is tenant-scoped (`ctx.user.id`).
 * The router never accepts a `userId` parameter — the user IS the tenant.
 */

import crypto from "crypto";
import { z } from "zod";

import * as db from "../db";
import { ValidationError } from "../_core/errors";
import { protectedProcedure, router } from "../_core/trpc";
import { buildExport, type ExportFormat, type ExportRow } from "../services/dataExport";

const formatEnum = z.enum(["json", "ndjson", "csv", "pdf"]);
const resourceEnum = z.enum([
  "token_usage",
  "scan_history",
  "gateway_audit",
  "alert_events",
  "alert_rules",
  "policies",
]);

type ResourceKind = z.infer<typeof resourceEnum>;
export type { ResourceKind };

interface ResourceConfig {
  title: string;
  columns: string[];
  columnHeaders: Record<string, string>;
  fetch: (userId: number, opts: { days: number }) => Promise<ExportRow[]>;
}

const RESOURCES: Record<ResourceKind, ResourceConfig> = {
  token_usage: {
    title: "Token Usage Report",
    columns: [
      "date",
      "model",
      "promptTokens",
      "completionTokens",
      "thinkingTokens",
      "totalTokens",
      "costUSD",
    ],
    columnHeaders: {
      date: "Date",
      model: "Model",
      promptTokens: "Prompt Tokens",
      completionTokens: "Completion Tokens",
      thinkingTokens: "Thinking Tokens",
      totalTokens: "Total Tokens",
      costUSD: "Cost (USD)",
    },
    fetch: async (userId, { days }) => {
      const usage = await db.getTokenUsageByUserId(userId, days);
      return usage.map((u) => ({
        date:
          u.date instanceof Date
            ? u.date.toISOString()
            : new Date(u.date as unknown as string).toISOString(),
        model: u.model ?? "",
        promptTokens: Number(u.promptTokens ?? 0),
        completionTokens: Number(u.completionTokens ?? 0),
        thinkingTokens: Number(u.thinkingTokens ?? 0),
        totalTokens: Number(u.totalTokens ?? 0),
        costUSD: Number(u.costUSD ?? 0).toFixed(6),
      }));
    },
  },
  scan_history: {
    title: "API Scan History",
    columns: ["id", "name", "createdAt", "totalEndpoints", "highRiskCount"],
    columnHeaders: {
      id: "ID",
      name: "Collection",
      createdAt: "Scanned At",
      totalEndpoints: "Endpoints",
      highRiskCount: "High Risk",
    },
    fetch: async (userId) => {
      const rows = await db.getRecentScans(userId, 1000);
      return rows.map((r) => ({
        id: r.id,
        name: r.collectionName,
        createdAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
        totalEndpoints: Number(r.totalFindings ?? 0),
        highRiskCount:
          r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL" ? Number(r.totalFindings ?? 0) : 0,
      }));
    },
  },
  gateway_audit: {
    title: "Gateway Audit Log",
    columns: ["id", "createdAt", "provider", "model", "decision", "latencyMs", "requestId"],
    columnHeaders: {
      id: "ID",
      createdAt: "Timestamp",
      provider: "Provider",
      model: "Model",
      decision: "Decision",
      latencyMs: "Latency (ms)",
      requestId: "Request ID",
    },
    fetch: async (userId) => {
      const rows = await db.getGatewayAuditRecent(userId, 5000);
      return rows.map((r) => ({
        id: r.id,
        createdAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
        provider: r.provider ?? "",
        model: r.model ?? "",
        decision: r.decision ?? "",
        latencyMs: r.latencyMs ?? 0,
        requestId: r.requestId ?? "",
      }));
    },
  },
  alert_events: {
    title: "Alert Event Log",
    columns: ["id", "firedAt", "ruleId", "severity", "channel", "delivered", "summary"],
    columnHeaders: {
      id: "ID",
      firedAt: "Fired At",
      ruleId: "Rule",
      severity: "Severity",
      channel: "Channel",
      delivered: "Delivered",
      summary: "Summary",
    },
    fetch: async (userId) => {
      const rows = await db.listAlertEvents(userId, 500);
      return rows.map((r) => ({
        id: r.id,
        firedAt: r.firedAt.toISOString(),
        ruleId: r.ruleId,
        severity: r.severity,
        channel: r.channel,
        delivered: r.delivered ? "yes" : "no",
        summary: r.summary,
      }));
    },
  },
  alert_rules: {
    title: "Alert Rules",
    columns: ["id", "name", "enabled", "severity", "window", "cooldownMinutes", "updatedAt"],
    columnHeaders: {
      id: "ID",
      name: "Name",
      enabled: "Enabled",
      severity: "Severity",
      window: "Window",
      cooldownMinutes: "Cooldown (min)",
      updatedAt: "Updated",
    },
    fetch: async (userId) => {
      const rows = await db.listAlertRules(userId);
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled ? "yes" : "no",
        severity: r.severity,
        window: r.window,
        cooldownMinutes: r.cooldownMinutes,
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
  },
  policies: {
    title: "Tenant Policies",
    columns: ["id", "name", "enabled", "appliesTo", "updatedAt"],
    columnHeaders: {
      id: "ID",
      name: "Name",
      enabled: "Enabled",
      appliesTo: "Applies To",
      updatedAt: "Updated",
    },
    fetch: async (userId) => {
      const rows = await db.listTenantPolicies(userId);
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled ? "yes" : "no",
        appliesTo: r.appliesTo,
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
  },
};

/**
 * Short-lived prepare → download tokens.
 *
 * Stores metadata only (not full row sets) so multi-instance deploys can
 * re-fetch on download. Prefers Redis when REDIS_URL is set; falls back to
 * an in-process Map in development/test only.
 *
 * Limits:
 *  - MAX_EXPORT_ROWS: hard cap when materializing for download
 *  - MAX_PENDING_EXPORTS: bound local Map size
 *  - EXPORT_TTL_MS: tokens expire after 5 minutes
 */
interface PendingExportMeta {
  userId: number;
  format: ExportFormat;
  resource: ResourceKind;
  days: number;
  expiresAt: number;
}

export type { PendingExportMeta };

const PENDING_EXPORTS = new Map<string, PendingExportMeta>();
const EXPORT_TTL_MS = 5 * 60_000;
const EXPORT_REDIS_PREFIX = "dataexport:token:";
/** Hard row cap — refuse unbounded materialization. */
export const MAX_EXPORT_ROWS = 10_000;
/** Bound concurrent pending tokens in this process (dev fallback). */
export const MAX_PENDING_EXPORTS = 64;

function mintToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function reapExpired(): void {
  const now = Date.now();
  for (const [token, data] of Array.from(PENDING_EXPORTS.entries())) {
    if (now > data.expiresAt) PENDING_EXPORTS.delete(token);
  }
}

/** Exported for unit tests (prepare → download metadata round-trip). */
export async function storePendingExport(token: string, meta: PendingExportMeta): Promise<void> {
  const { redis } = await import("../_core/cache");
  const payload = JSON.stringify(meta);
  try {
    if (process.env.REDIS_URL) {
      await redis.setex(`${EXPORT_REDIS_PREFIX}${token}`, Math.ceil(EXPORT_TTL_MS / 1000), payload);
      return;
    }
  } catch {
    // fall through to local Map
  }
  reapExpired();
  if (PENDING_EXPORTS.size >= MAX_PENDING_EXPORTS) {
    throw new ValidationError(
      "too many pending exports — download or wait for prior tokens to expire",
    );
  }
  PENDING_EXPORTS.set(token, meta);
}

/** Consume one-time token metadata (does not fetch rows). */
export async function consumePendingExportMeta(token: string): Promise<PendingExportMeta | null> {
  const { redis } = await import("../_core/cache");
  try {
    if (process.env.REDIS_URL) {
      const key = `${EXPORT_REDIS_PREFIX}${token}`;
      const raw = await redis.get(key);
      if (raw) {
        await redis.del(key);
        const meta = JSON.parse(raw) as PendingExportMeta;
        if (Date.now() > meta.expiresAt) return null;
        return meta;
      }
    }
  } catch {
    // fall through
  }
  const entry = PENDING_EXPORTS.get(token);
  if (!entry) return null;
  PENDING_EXPORTS.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

/** Build export bytes for a consumed token (re-fetches rows at download time). */
export async function buildExportFromToken(token: string): Promise<{
  filename: string;
  contentType: string;
  body: Buffer;
  recordCount: number;
} | null> {
  const meta = await consumePendingExportMeta(token);
  if (!meta) return null;
  const cfg = RESOURCES[meta.resource];
  if (!cfg) return null;
  const rows = await cfg.fetch(meta.userId, { days: meta.days });
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new ValidationError(`export exceeds ${MAX_EXPORT_ROWS} row limit`);
  }
  const out = await buildExport({
    format: meta.format,
    title: cfg.title,
    resource: meta.resource,
    columns: cfg.columns,
    columnHeaders: cfg.columnHeaders,
    rows,
  });
  return {
    filename: out.filename,
    contentType: out.contentType,
    body: out.body,
    recordCount: out.recordCount,
  };
}

/** @deprecated use consumePendingExportMeta + buildExportFromToken */
export function consumePendingExport(token: string): PendingExportMeta | null {
  const entry = PENDING_EXPORTS.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    PENDING_EXPORTS.delete(token);
    return null;
  }
  PENDING_EXPORTS.delete(token);
  return entry;
}

export const dataExportRouter = router({
  listResources: protectedProcedure.query(() => {
    return Object.entries(RESOURCES).map(([id, cfg]) => ({
      id,
      title: cfg.title,
      columns: cfg.columns,
    }));
  }),

  /**
   * Inline export — small result sets only. For very large data the caller
   * should use `prepare` + the streaming download endpoint.
   */
  inline: protectedProcedure
    .input(
      z.object({
        resource: resourceEnum,
        format: formatEnum,
        days: z.number().int().min(1).max(365).default(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cfg = RESOURCES[input.resource];
      if (!cfg) throw new ValidationError("unknown resource");
      const rows = await cfg.fetch(ctx.user.id, { days: input.days });
      if (rows.length > MAX_EXPORT_ROWS) {
        throw new ValidationError(
          `result set exceeds ${MAX_EXPORT_ROWS} row limit — narrow filters or use prepare/download with a smaller window`,
        );
      }
      // Refuse large payloads through tRPC; force the streaming path.
      if (rows.length > 5000) {
        throw new ValidationError("result set too large for inline export — use prepare/download");
      }
      const out = await buildExport({
        format: input.format,
        title: cfg.title,
        resource: input.resource,
        columns: cfg.columns,
        columnHeaders: cfg.columnHeaders,
        rows,
      });
      return {
        filename: out.filename,
        contentType: out.contentType,
        recordCount: out.recordCount,
        sha256: out.sha256,
        // Base64 — tRPC JSON serialises Buffer poorly otherwise.
        bodyBase64: out.body.toString("base64"),
      };
    }),

  /**
   * Stage an export; returns a one-time download token. The dashboard
   * should immediately follow up with a window.location to
   * `/api/internal/data-export/<token>` which streams the bytes.
   */
  prepare: protectedProcedure
    .input(
      z.object({
        resource: resourceEnum,
        format: formatEnum,
        days: z.number().int().min(1).max(365).default(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cfg = RESOURCES[input.resource];
      if (!cfg) throw new ValidationError("unknown resource");
      // Lightweight count probe — full rows materialize on download only.
      const rows = await cfg.fetch(ctx.user.id, { days: input.days });
      if (rows.length > MAX_EXPORT_ROWS) {
        throw new ValidationError(
          `export exceeds ${MAX_EXPORT_ROWS} row limit — narrow the date range`,
        );
      }
      const token = mintToken();
      await storePendingExport(token, {
        userId: ctx.user.id,
        format: input.format,
        resource: input.resource,
        days: input.days,
        expiresAt: Date.now() + EXPORT_TTL_MS,
      });
      return {
        token,
        recordCount: rows.length,
        expiresInSeconds: Math.floor(EXPORT_TTL_MS / 1000),
        maxRows: MAX_EXPORT_ROWS,
        downloadPath: `/api/internal/data-export/${token}`,
      };
    }),
});

/**
 * Helper for the HTTP download endpoint to look up the row-builder config
 * for a resource. Exported because the route handler lives in `_core/http`
 * but the config maps live here.
 */
export function getResourceConfig(kind: ResourceKind): ResourceConfig {
  return RESOURCES[kind];
}
