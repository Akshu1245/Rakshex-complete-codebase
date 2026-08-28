import crypto from "node:crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { gatewayCallAttribution } from "@rakshex/database";
import {
  controlPlaneCredentials,
  providerAccounts,
  teamAiUsageEvents,
} from "@rakshex/database/schema-enterprise";
import {
  providerBillingConnections,
  providerBillingRows,
  providerReconciliationWindows,
} from "@rakshex/database/schema-billing";
import * as db from "../../db";
import { decryptSecret } from "../vault";

const OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs";
const OPENAI_COMPLETIONS_USAGE_URL = "https://api.openai.com/v1/organization/usage/completions";
const DRIFT_LIMIT = 0.01;

const nullableString = z.string().nullable().optional();

const openAiCostResultSchema = z
  .object({
    object: z.literal("organization.costs.result"),
    amount: z
      .object({
        currency: z.string().optional(),
        value: z.number().optional(),
      })
      .optional(),
    api_key_id: nullableString,
    line_item: nullableString,
    project_id: nullableString,
    quantity: z.number().nullable().optional(),
  })
  .passthrough();

const openAiCompletionUsageResultSchema = z
  .object({
    object: z.literal("organization.usage.completions.result"),
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    num_model_requests: z.number().int().nonnegative(),
    input_cached_tokens: z.number().int().nonnegative().optional().default(0),
    api_key_id: nullableString,
    model: nullableString,
    project_id: nullableString,
  })
  .passthrough();

function bucketSchema<T extends z.ZodTypeAny>(resultSchema: T) {
  return z
    .object({
      object: z.string(),
      start_time: z.number().int().nonnegative(),
      end_time: z.number().int().nonnegative(),
      results: z.array(resultSchema),
    })
    .passthrough();
}

export const openAiCostsPageSchema = z
  .object({
    object: z.string(),
    data: z.array(bucketSchema(openAiCostResultSchema)),
    has_more: z.boolean(),
    next_page: z.string().nullable().optional(),
  })
  .passthrough();

export const openAiCompletionsUsagePageSchema = z
  .object({
    object: z.string(),
    data: z.array(bucketSchema(openAiCompletionUsageResultSchema)),
    has_more: z.boolean(),
    next_page: z.string().nullable().optional(),
  })
  .passthrough();

export type OpenAiCostsPage = z.infer<typeof openAiCostsPageSchema>;
export type OpenAiCompletionsUsagePage = z.infer<typeof openAiCompletionsUsagePageSchema>;

export interface ProviderEvidenceRow {
  rowKind: "cost" | "usage";
  sourceRowId: string;
  bucketStart: Date;
  bucketEnd: Date;
  projectId?: string;
  apiKeyId?: string;
  lineItem?: string;
  model?: string;
  amountUsd?: number;
  currency?: string;
  quantity?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  requestCount?: number;
  raw: Record<string, unknown>;
}

const PROVIDER_EVIDENCE_ID_DOMAIN = "rakshex-provider-evidence-v1";

function boundedProviderKeyRef(value: string | null | undefined): string {
  if (!value) return "";
  return Buffer.from(value, "utf8").toString("base64url").slice(0, 48);
}

function sourceId(
  kind: "cost" | "usage",
  values: readonly unknown[],
  providerKeyRef?: string | null,
): string {
  // Idempotency key for provider evidence rows. OpenAI's `api_key_id` is a
  // provider identifier, not a password, so it is not fed into a hash
  // function (HMAC-SHA256 is not a password KDF). Non-secret dimensions are
  // HMAC'd; the key ref is appended as a bounded token so two keys in the
  // same bucket cannot collide.
  const digest = crypto
    .createHmac("sha256", PROVIDER_EVIDENCE_ID_DOMAIN)
    .update(JSON.stringify([kind, ...values]))
    .digest("hex");
  const keyPart = boundedProviderKeyRef(providerKeyRef);
  return keyPart ? `${digest}:${keyPart}`.slice(0, 128) : digest;
}

export function normalizeOpenAiCosts(page: unknown): ProviderEvidenceRow[] {
  const parsed = openAiCostsPageSchema.parse(page);
  const rows: ProviderEvidenceRow[] = [];

  for (const bucket of parsed.data) {
    for (const result of bucket.results) {
      const amount = result.amount?.value;
      const currency = result.amount?.currency?.toLowerCase();
      if (amount == null) continue;
      rows.push({
        rowKind: "cost",
        sourceRowId: sourceId(
          "cost",
          [
            bucket.start_time,
            bucket.end_time,
            result.project_id ?? null,
            result.line_item ?? null,
            currency ?? null,
            amount,
            result.quantity ?? null,
          ],
          result.api_key_id,
        ),
        bucketStart: new Date(bucket.start_time * 1000),
        bucketEnd: new Date(bucket.end_time * 1000),
        projectId: result.project_id ?? undefined,
        apiKeyId: result.api_key_id ?? undefined,
        lineItem: result.line_item ?? undefined,
        amountUsd: currency === "usd" ? amount : undefined,
        currency,
        quantity: result.quantity ?? undefined,
        raw: result as Record<string, unknown>,
      });
    }
  }
  return rows;
}

export function normalizeOpenAiCompletionsUsage(page: unknown): ProviderEvidenceRow[] {
  const parsed = openAiCompletionsUsagePageSchema.parse(page);
  const rows: ProviderEvidenceRow[] = [];

  for (const bucket of parsed.data) {
    for (const result of bucket.results) {
      rows.push({
        rowKind: "usage",
        sourceRowId: sourceId(
          "usage",
          [
            bucket.start_time,
            bucket.end_time,
            result.project_id ?? null,
            result.model ?? null,
            result.input_tokens,
            result.output_tokens,
            result.input_cached_tokens,
            result.num_model_requests,
          ],
          result.api_key_id,
        ),
        bucketStart: new Date(bucket.start_time * 1000),
        bucketEnd: new Date(bucket.end_time * 1000),
        projectId: result.project_id ?? undefined,
        apiKeyId: result.api_key_id ?? undefined,
        model: result.model ?? undefined,
        inputTokens: result.input_tokens,
        outputTokens: result.output_tokens,
        cachedInputTokens: result.input_cached_tokens,
        requestCount: result.num_model_requests,
        raw: result as Record<string, unknown>,
      });
    }
  }
  return rows;
}

export function calculateReconciliation(providerBilledUsd: number, gatewayAttributedUsd: number) {
  const driftUsd = providerBilledUsd - gatewayAttributedUsd;
  const denominator = Math.max(Math.abs(providerBilledUsd), Number.EPSILON);
  const driftPct = Math.abs(driftUsd) / denominator;
  return {
    providerBilledUsd,
    gatewayAttributedUsd,
    driftUsd,
    driftPct,
    status: driftPct > DRIFT_LIMIT ? ("drift" as const) : ("ok" as const),
  };
}

export function providerAllocationFactor(providerBilledUsd: number, gatewayAttributedUsd: number) {
  if (!Number.isFinite(providerBilledUsd) || !Number.isFinite(gatewayAttributedUsd)) return null;
  if (Math.abs(gatewayAttributedUsd) <= Number.EPSILON) return null;
  return providerBilledUsd / gatewayAttributedUsd;
}

function buildAdminUrl(
  endpoint: "costs" | "usage",
  startTime: number,
  endTime: number,
  page?: string,
): string {
  const url = new URL(endpoint === "costs" ? OPENAI_COSTS_URL : OPENAI_COMPLETIONS_USAGE_URL);
  url.searchParams.set("start_time", String(startTime));
  url.searchParams.set("end_time", String(endTime));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "180");
  if (endpoint === "costs") {
    for (const group of ["project_id", "api_key_id", "line_item"]) {
      url.searchParams.append("group_by", group);
    }
  } else {
    for (const group of ["project_id", "api_key_id", "model"]) {
      url.searchParams.append("group_by", group);
    }
  }
  if (page) url.searchParams.set("page", page);
  return url.toString();
}

async function fetchAdminJson(url: string, adminKey: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${adminKey}`,
      accept: "application/json",
      "user-agent": "Rakshex-Billing-Reconciler/1.0",
    },
  });
  if (!response.ok) {
    // Provider error bodies can contain account metadata; never echo them.
    throw new Error(`OpenAI admin API returned ${response.status}`);
  }
  return response.json();
}

async function loadOpenAiBillingKey(workspaceId: number, providerAccountId: number) {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");

  const [binding] = await database
    .select()
    .from(providerBillingConnections)
    .where(
      and(
        eq(providerBillingConnections.workspaceId, workspaceId),
        eq(providerBillingConnections.providerAccountId, providerAccountId),
        eq(providerBillingConnections.provider, "openai"),
      ),
    )
    .limit(1);
  if (!binding) throw new Error("OpenAI billing connection is not configured");

  const [account] = await database
    .select({ id: providerAccounts.id })
    .from(providerAccounts)
    .where(
      and(
        eq(providerAccounts.id, providerAccountId),
        eq(providerAccounts.workspaceId, workspaceId),
        eq(providerAccounts.provider, "openai"),
      ),
    )
    .limit(1);
  if (!account) throw new Error("OpenAI provider account does not belong to this workspace");

  const [credential] = await database
    .select()
    .from(controlPlaneCredentials)
    .where(
      and(
        eq(controlPlaneCredentials.id, binding.billingCredentialId),
        eq(controlPlaneCredentials.workspaceId, workspaceId),
        eq(controlPlaneCredentials.provider, "openai"),
        eq(controlPlaneCredentials.status, "active"),
      ),
    )
    .limit(1);
  if (!credential || credential.credentialType !== "admin_readonly_api_key") {
    throw new Error("OpenAI billing requires an active admin_readonly_api_key credential");
  }
  if (credential.expiresAt && credential.expiresAt <= new Date()) {
    throw new Error("OpenAI billing credential has expired");
  }

  const key = decryptSecret(credential.encryptedValue, `workspace:${workspaceId}`);
  await database
    .update(controlPlaneCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(controlPlaneCredentials.id, credential.id));
  return key;
}

async function fetchAllEvidence(
  endpoint: "costs" | "usage",
  adminKey: string,
  startTime: number,
  endTime: number,
): Promise<ProviderEvidenceRow[]> {
  const all: ProviderEvidenceRow[] = [];
  let page: string | undefined;

  do {
    const payload = await fetchAdminJson(
      buildAdminUrl(endpoint, startTime, endTime, page),
      adminKey,
    );
    if (endpoint === "costs") {
      const parsed = openAiCostsPageSchema.parse(payload);
      all.push(...normalizeOpenAiCosts(parsed));
      page = parsed.has_more ? (parsed.next_page ?? undefined) : undefined;
    } else {
      const parsed = openAiCompletionsUsagePageSchema.parse(payload);
      all.push(...normalizeOpenAiCompletionsUsage(parsed));
      page = parsed.has_more ? (parsed.next_page ?? undefined) : undefined;
    }
    if (page === "") page = undefined;
  } while (page);

  return all;
}

async function persistEvidence(
  workspaceId: number,
  providerAccountId: number,
  rows: ProviderEvidenceRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");

  await database
    .insert(providerBillingRows)
    .values(
      rows.map((row) => ({
        workspaceId,
        providerAccountId,
        provider: "openai" as const,
        rowKind: row.rowKind,
        sourceRowId: row.sourceRowId,
        bucketStart: row.bucketStart,
        bucketEnd: row.bucketEnd,
        projectId: row.projectId,
        apiKeyId: row.apiKeyId,
        lineItem: row.lineItem,
        model: row.model,
        amountUsd: row.amountUsd == null ? undefined : String(row.amountUsd),
        currency: row.currency,
        quantity: row.quantity == null ? undefined : String(row.quantity),
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cachedInputTokens: row.cachedInputTokens,
        requestCount: row.requestCount,
        raw: row.raw,
      })),
    )
    .onConflictDoNothing();
}

export async function reconcileOpenAiBilling(input: {
  workspaceId: number;
  providerAccountId: number;
  start: Date;
  end: Date;
}) {
  if (!(input.start < input.end)) throw new Error("Reconciliation start must be before end");
  const startTime = Math.floor(input.start.getTime() / 1000);
  const endTime = Math.floor(input.end.getTime() / 1000);
  const adminKey = await loadOpenAiBillingKey(input.workspaceId, input.providerAccountId);

  const [costRows, usageRows] = await Promise.all([
    fetchAllEvidence("costs", adminKey, startTime, endTime),
    fetchAllEvidence("usage", adminKey, startTime, endTime),
  ]);
  await persistEvidence(input.workspaceId, input.providerAccountId, [...costRows, ...usageRows]);

  const nonUsd = costRows.filter((row) => row.currency && row.currency !== "usd");
  if (nonUsd.length > 0) {
    throw new Error("OpenAI returned non-USD cost rows; reconciliation requires USD source rows");
  }
  const providerBilledUsd = costRows.reduce((sum, row) => sum + (row.amountUsd ?? 0), 0);

  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const [gateway] = await database
    .select({
      amount: sql<string>`coalesce(sum(${teamAiUsageEvents.costUsd}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(teamAiUsageEvents)
    .where(
      and(
        eq(teamAiUsageEvents.workspaceId, input.workspaceId),
        eq(teamAiUsageEvents.providerAccountId, input.providerAccountId),
        eq(teamAiUsageEvents.provider, "openai"),
        eq(teamAiUsageEvents.source, "gateway"),
        gte(teamAiUsageEvents.occurredAt, input.start),
        lt(teamAiUsageEvents.occurredAt, input.end),
      ),
    );

  const gatewayAttributedUsd = Number(gateway?.amount ?? 0);
  const result = calculateReconciliation(providerBilledUsd, gatewayAttributedUsd);
  const allocationFactor = providerAllocationFactor(providerBilledUsd, gatewayAttributedUsd);

  const snapshot = await database.transaction(async (tx) => {
    if (allocationFactor == null) {
      await tx
        .update(gatewayCallAttribution)
        .set({ providerReconciledCostUsd: null })
        .where(
          and(
            eq(gatewayCallAttribution.workspaceId, input.workspaceId),
            eq(gatewayCallAttribution.providerAccountId, input.providerAccountId),
            eq(gatewayCallAttribution.provider, "openai"),
            gte(gatewayCallAttribution.occurredAt, input.start),
            lt(gatewayCallAttribution.occurredAt, input.end),
          ),
        );
    } else {
      await tx
        .update(gatewayCallAttribution)
        .set({
          providerReconciledCostUsd: sql`${gatewayCallAttribution.settledCostUsd} * ${allocationFactor}`,
        })
        .where(
          and(
            eq(gatewayCallAttribution.workspaceId, input.workspaceId),
            eq(gatewayCallAttribution.providerAccountId, input.providerAccountId),
            eq(gatewayCallAttribution.provider, "openai"),
            gte(gatewayCallAttribution.occurredAt, input.start),
            lt(gatewayCallAttribution.occurredAt, input.end),
          ),
        );
    }

    const [row] = await tx
      .insert(providerReconciliationWindows)
      .values({
        workspaceId: input.workspaceId,
        providerAccountId: input.providerAccountId,
        provider: "openai",
        windowStart: input.start,
        windowEnd: input.end,
        providerBilledUsd: String(result.providerBilledUsd),
        gatewayAttributedUsd: String(result.gatewayAttributedUsd),
        driftUsd: String(result.driftUsd),
        driftPct: String(result.driftPct),
        status: result.status,
        providerRowCount: costRows.length,
        gatewayRowCount: gateway?.count ?? 0,
        metadata: {
          usageRowCount: usageRows.length,
          source: "openai_admin_api",
          driftThreshold: DRIFT_LIMIT,
          allocationMethod:
            allocationFactor == null ? "unavailable" : "pro_rata_gateway_settled_cost",
          allocationFactor,
        },
      })
      .onConflictDoUpdate({
        target: [
          providerReconciliationWindows.workspaceId,
          providerReconciliationWindows.providerAccountId,
          providerReconciliationWindows.windowStart,
          providerReconciliationWindows.windowEnd,
        ],
        set: {
          providerBilledUsd: String(result.providerBilledUsd),
          gatewayAttributedUsd: String(result.gatewayAttributedUsd),
          driftUsd: String(result.driftUsd),
          driftPct: String(result.driftPct),
          status: result.status,
          providerRowCount: costRows.length,
          gatewayRowCount: gateway?.count ?? 0,
          metadata: {
            usageRowCount: usageRows.length,
            source: "openai_admin_api",
            driftThreshold: DRIFT_LIMIT,
            allocationMethod:
              allocationFactor == null ? "unavailable" : "pro_rata_gateway_settled_cost",
            allocationFactor,
          },
          reconciledAt: new Date(),
        },
      })
      .returning();
    return row;
  });

  return {
    ...result,
    providerRowCount: costRows.length,
    usageRowCount: usageRows.length,
    gatewayRowCount: gateway?.count ?? 0,
    allocationFactor,
    snapshotId: snapshot?.id,
  };
}

export const __test = {
  buildAdminUrl,
  calculateReconciliation,
  providerAllocationFactor,
  normalizeOpenAiCosts,
  normalizeOpenAiCompletionsUsage,
};
