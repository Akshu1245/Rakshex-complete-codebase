import { z } from "zod";
import {
  type ProviderEvidenceRow,
  sourceId,
} from "./openAiBillingReconciliation";

/**
 * Google Cloud billing export reconciliation — CSV/GCS path (primary).
 *
 * HARD TRUTHS:
 * - Google Cloud billing export is the reconciliation-grade source: it
 *   lands 24-48h late and rows can RESTATE within the month as
 *   credits/adjustments land. Never exact, never real-time, never the gate.
 * - This file implements the CSV export consumed from GCS (standard
 *   "usage cost" CSV export). It needs NO BigQuery dependency.
 * - BigQuery alternative (documented, not implemented): query
 *   `<project>.<dataset>.gcp_billing_export_resource_v1_<BILLING_ID>`
 *   directly. Same columns, SQL instead of CSV; better for large orgs.
 *   Reuse parseGoogleBillingCsv's row normalizer on the BigQuery row shape
 *   if you add it later.
 *
 * The export charges net cost per row; credits arrive as separate fields on
 * the same row (or separate rows in some export variants). We net credits
 * per row where present and document the restatement risk in metadata.
 */

/** Columns we consume from the standard detailed billing export CSV. */
const googleBillingRecordSchema = z
  .object({
    service_description: z.string(),
    service_id: z.string().optional(),
    sku_id: z.string().optional(),
    sku_description: z.string().optional(),
    usage_start_time: z.string(),
    usage_end_time: z.string(),
    project_id: z.string().optional(),
    project_name: z.string().optional(),
    location_country: z.string().optional(),
    location_region: z.string().optional(),
    cost: z.string().optional(),
    currency: z.string().optional(),
    usage_amount: z.string().optional(),
    usage_unit: z.string().optional(),
    credits: z.string().optional(),
    invoice_month: z.string().optional(),
    cost_type: z.string().optional(),
  })
  .passthrough();

type GoogleBillingRecord = z.infer<typeof googleBillingRecordSchema>;

/** Header aliases across export variants (v1 vs legacy column naming). */
const HEADER_ALIASES: Record<string, string> = {
  "service.description": "service_description",
  "service.id": "service_id",
  "sku.id": "sku_id",
  "sku.description": "sku_description",
  "usage_start_time": "usage_start_time",
  "usage_end_time": "usage_end_time",
  "project.id": "project_id",
  "project.name": "project_name",
  "location.country": "location_country",
  "location.region": "location_region",
  "cost": "cost",
  "currency": "currency",
  "usage.amount": "usage_amount",
  "usage.unit": "usage_unit",
  "credits": "credits",
  "invoice.month": "invoice_month",
  "cost_type": "cost_type",
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/** Minimal RFC-4180-ish CSV parse (handles quoted commas/escapes). No new dep. */
export function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]!).map((h) =>
    HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase(),
  );
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]!] = (fields[i] ?? "").trim();
    }
    return row;
  });
}

function sumCredits(creditsJson: string | undefined): number {
  if (!creditsJson) return 0;
  try {
    const credits = JSON.parse(creditsJson) as Array<{ amount?: number }>;
    if (!Array.isArray(credits)) return 0;
    return credits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * Normalize Google billing export rows into the SAME providerBillingRows
 * shape the OpenAI reconciler uses. Net cost = cost - credits (same
 * currency per row in the export). Non-USD rows keep currency recorded but
 * amountUsd unset — callers must not treat them as zero.
 */
export function normalizeGoogleBillingRows(
  records: Record<string, string>[],
): ProviderEvidenceRow[] {
  const rows: ProviderEvidenceRow[] = [];

  for (const raw of records) {
    const parsed = googleBillingRecordSchema.safeParse(raw);
    if (!parsed.success) continue;
    const rec: GoogleBillingRecord = parsed.data;

    const bucketStart = new Date(rec.usage_start_time);
    const bucketEnd = new Date(rec.usage_end_time);
    if (Number.isNaN(bucketStart.getTime()) || Number.isNaN(bucketEnd.getTime())) continue;

    const gross = Number(rec.cost ?? "");
    if (!Number.isFinite(gross)) continue;
    const net = gross - sumCredits(rec.credits);
    const currency = rec.currency?.toLowerCase();

    rows.push({
      rowKind: "cost",
      sourceRowId: sourceId(
        "cost",
        [
          "google",
          rec.usage_start_time,
          rec.usage_end_time,
          rec.project_id ?? null,
          rec.service_id ?? null,
          rec.sku_id ?? null,
          currency ?? null,
          net,
        ],
      ),
      bucketStart,
      bucketEnd,
      projectId: rec.project_id || undefined,
      apiKeyId: undefined,
      lineItem: rec.sku_description || rec.sku_id || undefined,
      model: rec.service_description || undefined,
      amountUsd: currency === "usd" ? net : undefined,
      currency,
      quantity: Number.isFinite(Number(rec.usage_amount)) ? Number(rec.usage_amount) : undefined,
      raw: raw as Record<string, unknown>,
    });
  }
  return rows;
}

/** Convenience: CSV text straight to evidence rows. */
export function parseGoogleBillingCsv(csv: string): ProviderEvidenceRow[] {
  return normalizeGoogleBillingRows(parseCsvRows(csv));
}

export interface GcsExportSource {
  bucket: string;
  prefix: string;
  oauthToken: string;
}

async function gcsJson(url: string, oauthToken: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${oauthToken}`,
      accept: "application/json",
      "user-agent": "Rakshex-Billing-Reconciler/1.0",
    },
  });
  if (!response.ok) {
    // GCS error bodies can contain bucket metadata; never echo them.
    throw new Error(`GCS API returned ${response.status}`);
  }
  return response.json();
}

const gcsListSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            name: z.string(),
            updated: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

/** List export objects, newest first, CSV objects only. */
export async function listGoogleBillingExports(source: GcsExportSource): Promise<string[]> {
  const params = new URLSearchParams({ prefix: source.prefix, maxResults: "100" });
  const payload = await gcsJson(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(source.bucket)}/o?${params}`,
    source.oauthToken,
  );
  const parsed = gcsListSchema.parse(payload);
  return (parsed.items ?? [])
    .filter((item) => item.name.endsWith(".csv"))
    .sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""))
    .map((item) => item.name);
}

/** Download the newest CSV export object. */
export async function fetchLatestGoogleBillingCsv(source: GcsExportSource): Promise<string> {
  const objects = await listGoogleBillingExports(source);
  if (objects.length === 0) throw new Error("No billing export CSV found in bucket");
  const response = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(source.bucket)}/o/${encodeURIComponent(objects[0]!)}?alt=media`,
    {
      headers: {
        authorization: `Bearer ${source.oauthToken}`,
        "user-agent": "Rakshex-Billing-Reconciler/1.0",
      },
    },
  );
  if (!response.ok) throw new Error(`GCS object download returned ${response.status}`);
  return response.text();
}

export const __test = {
  parseCsvRows,
  normalizeGoogleBillingRows,
  parseGoogleBillingCsv,
};
