import { z } from "zod";
import {
  type ProviderEvidenceRow,
  sourceId,
} from "./openAiBillingReconciliation";

/**
 * Anthropic admin usage/cost reconciliation.
 *
 * ASSUMPTIONS (marked because the exact response envelope is versioned by
 * Anthropic's docs):
 * - Cost report:  GET /v1/organizations/cost_report
 * - Usage report: GET /v1/organizations/usage_report/messages
 * - Query params: starting_at, ending_at (ISO-8601), bucket_width (1d),
 *   page / has_more / next_page pagination.
 * - Auth: x-api-key header with an ADMIN key (admin-key-only endpoints).
 * Schemas are .passthrough() so additive provider fields never break us;
 * the normalizers only consume the documented subset above.
 *
 * HARD TRUTH: this is reconciliation-grade evidence only — ~5 minutes
 * delayed at read time, subject to post-hoc adjustment. It NEVER feeds the
 * real-time enforcement gate (B1's local metering does that); the worker
 * only reconciles and reports.
 */

const ANTHROPIC_API_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";

const nullableString = z.string().nullable().optional();

const anthropicCostResultSchema = z
  .object({
    amount: z
      .object({ currency: z.string().optional(), value: z.number().optional() })
      .optional(),
    model: nullableString,
    workspace_id: nullableString,
    api_key_id: nullableString,
  })
  .passthrough();

const anthropicUsageResultSchema = z
  .object({
    model: nullableString,
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cache_creation_input_tokens: z.number().int().nonnegative().optional().default(0),
    cache_read_input_tokens: z.number().int().nonnegative().optional().default(0),
    workspace_id: nullableString,
    api_key_id: nullableString,
  })
  .passthrough();

function reportPageSchema<T extends z.ZodTypeAny>(resultSchema: T) {
  return z
    .object({
      object: z.string().optional(),
      data: z
        .array(
          z
            .object({
              starting_at: z.string(),
              ending_at: z.string(),
              results: z.array(resultSchema),
            })
            .passthrough(),
        )
        .default([]),
      has_more: z.boolean().optional().default(false),
      next_page: z.string().nullable().optional(),
    })
    .passthrough();
}

export const anthropicCostReportSchema = reportPageSchema(anthropicCostResultSchema);
export const anthropicUsageReportSchema = reportPageSchema(anthropicUsageResultSchema);

export type AnthropicCostReport = z.infer<typeof anthropicCostReportSchema>;
export type AnthropicUsageReport = z.infer<typeof anthropicUsageReportSchema>;

export function normalizeAnthropicCosts(page: unknown): ProviderEvidenceRow[] {
  const parsed = anthropicCostReportSchema.parse(page);
  const rows: ProviderEvidenceRow[] = [];

  for (const bucket of parsed.data) {
    const bucketStart = new Date(bucket.starting_at);
    const bucketEnd = new Date(bucket.ending_at);
    if (Number.isNaN(bucketStart.getTime()) || Number.isNaN(bucketEnd.getTime())) continue;
    for (const result of bucket.results) {
      const amount = result.amount?.value;
      const currency = result.amount?.currency?.toLowerCase();
      if (amount == null) continue;
      rows.push({
        rowKind: "cost",
        sourceRowId: sourceId(
          "cost",
          [
            "anthropic",
            bucket.starting_at,
            bucket.ending_at,
            result.workspace_id ?? null,
            result.model ?? null,
            currency ?? null,
            amount,
          ],
          result.api_key_id,
        ),
        bucketStart,
        bucketEnd,
        projectId: result.workspace_id ?? undefined,
        apiKeyId: result.api_key_id ?? undefined,
        lineItem: result.model ?? undefined,
        model: result.model ?? undefined,
        amountUsd: currency === "usd" ? amount : undefined,
        currency,
        raw: result as Record<string, unknown>,
      });
    }
  }
  return rows;
}

export function normalizeAnthropicUsage(page: unknown): ProviderEvidenceRow[] {
  const parsed = anthropicUsageReportSchema.parse(page);
  const rows: ProviderEvidenceRow[] = [];

  for (const bucket of parsed.data) {
    const bucketStart = new Date(bucket.starting_at);
    const bucketEnd = new Date(bucket.ending_at);
    if (Number.isNaN(bucketStart.getTime()) || Number.isNaN(bucketEnd.getTime())) continue;
    for (const result of bucket.results) {
      rows.push({
        rowKind: "usage",
        sourceRowId: sourceId(
          "usage",
          [
            "anthropic",
            bucket.starting_at,
            bucket.ending_at,
            result.workspace_id ?? null,
            result.model ?? null,
            result.input_tokens,
            result.output_tokens,
            result.cache_creation_input_tokens,
            result.cache_read_input_tokens,
          ],
          result.api_key_id,
        ),
        bucketStart,
        bucketEnd,
        projectId: result.workspace_id ?? undefined,
        apiKeyId: result.api_key_id ?? undefined,
        model: result.model ?? undefined,
        inputTokens: result.input_tokens,
        outputTokens: result.output_tokens,
        cachedInputTokens: result.cache_read_input_tokens,
        requestCount: undefined,
        raw: result as Record<string, unknown>,
      });
    }
  }
  return rows;
}

async function fetchAnthropicPage(
  path: string,
  params: URLSearchParams,
  adminKey: string,
): Promise<unknown> {
  const url = new URL(path, ANTHROPIC_API_BASE);
  url.search = params.toString();
  const response = await fetch(url.toString(), {
    headers: {
      "x-api-key": adminKey,
      "anthropic-version": ANTHROPIC_VERSION,
      accept: "application/json",
      "user-agent": "Rakshex-Billing-Reconciler/1.0",
    },
  });
  if (!response.ok) {
    // Provider error bodies can contain account metadata; never echo them.
    throw new Error(`Anthropic admin API returned ${response.status}`);
  }
  return response.json();
}

function reportParams(start: Date, end: Date, page?: string): URLSearchParams {
  const params = new URLSearchParams({
    starting_at: start.toISOString(),
    ending_at: end.toISOString(),
    bucket_width: "1d",
  });
  if (page) params.set("page", page);
  return params;
}

async function fetchAllReport(
  path: string,
  adminKey: string,
  start: Date,
  end: Date,
): Promise<unknown[]> {
  const pages: unknown[] = [];
  let page: string | undefined;
  do {
    const payload = await fetchAnthropicPage(path, reportParams(start, end, page), adminKey);
    pages.push(payload);
    const probe = reportPageSchema(z.unknown()).parse(payload);
    page = probe.has_more ? (probe.next_page ?? undefined) : undefined;
    if (page === "") page = undefined;
  } while (page);
  return pages;
}

export async function fetchAnthropicEvidence(
  adminKey: string,
  start: Date,
  end: Date,
): Promise<{ costRows: ProviderEvidenceRow[]; usageRows: ProviderEvidenceRow[] }> {
  const [costPages, usagePages] = await Promise.all([
    fetchAllReport("/v1/organizations/cost_report", adminKey, start, end),
    fetchAllReport("/v1/organizations/usage_report/messages", adminKey, start, end),
  ]);
  return {
    costRows: costPages.flatMap((p) => normalizeAnthropicCosts(p)),
    usageRows: usagePages.flatMap((p) => normalizeAnthropicUsage(p)),
  };
}

export const __test = {
  normalizeAnthropicCosts,
  normalizeAnthropicUsage,
};
