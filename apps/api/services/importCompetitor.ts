/**
 * Competitor Import System — Migrate from any AI governance tool to Rakshex.
 *
 * Supports: Helicone, Portkey, Lakera Guard, LangSmith, Postman, Swagger/OpenAPI,
 *           Insomnia, Bruno, and universal CSV/JSON with column mapping.
 */

import * as db from "../db";
import { logger } from "../_core/logger";
import { parseCollectionImport } from "./collectionImport/secureParse";
import { scanCollectionForCredentials } from "./collectionCredentialScan";
import { scanCollectionForGateway } from "./gatewayCollectionScan";
import { ensurePersonalWorkspace } from "./workspaceContext";

// ── Types ────────────────────────────────────────────────────────────────────

export type ImportSource =
  | "helicone"
  | "portkey"
  | "lakera"
  | "langsmith"
  | "postman"
  | "openapi"
  | "insomnia"
  | "bruno"
  | "universal_csv"
  | "universal_json";

export interface ImportResult {
  source: ImportSource;
  recordsImported: number;
  recordsSkipped: number;
  errors: string[];
  collectionsCreated: number;
  gatewayLogsImported: number;
  tokenUsageImported: number;
  policiesImported: number;
  scannedImports: boolean;
  durationMs: number;
  /** For collection-format imports (postman/openapi/insomnia/bruno). */
  collectionId?: string;
  credentialFindings?: number;
  gatewayFindings?: number;
}

export interface ImportPreview {
  source: ImportSource;
  detectedFormat: string;
  recordCount: number;
  sampleRows: Record<string, unknown>[];
  columns: string[];
  estimatedCollectionsImport: number;
  estimatedGatewayLogsImport: number;
  warnings: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyResult(source: ImportSource): ImportResult {
  return {
    source,
    recordsImported: 0,
    recordsSkipped: 0,
    errors: [],
    collectionsCreated: 0,
    gatewayLogsImported: 0,
    tokenUsageImported: 0,
    policiesImported: 0,
    scannedImports: false,
    durationMs: 0,
  };
}

async function ingestGatewayRecord(args: {
  userId: number;
  requestId: string;
  model: string;
  provider: string;
  decision: "allowed" | "blocked" | "errored";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptFingerprint: string;
  latencyMs: number;
  timestamp: Date;
}): Promise<void> {
  await (db.recordGatewayAudit as any)({
    tenantId: String(args.userId),
    requestId: args.requestId,
    model: args.model,
    provider: args.provider,
    decision: args.decision,
    promptFingerprint: args.promptFingerprint,
    startedAt: args.timestamp.getTime() - args.latencyMs,
    endedAt: args.timestamp.getTime(),
    usage: {
      prompt_tokens: args.promptTokens,
      completion_tokens: args.completionTokens,
      total_tokens: args.totalTokens,
    },
  });
}

function logComplete(userId: number, source: string, result: ImportResult): void {
  logger.info({ userId, importSource: source, ...result }, `[Import] ${source} import complete`);
}

// ── Helicone Import ──────────────────────────────────────────────────────────

interface HeliconeRequestRow {
  request_id?: string;
  request_created_at?: string;
  request_model?: string;
  response_model?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  latency?: number;
  cost?: number;
}

export async function importHelicone(userId: number, raw: string | object): Promise<ImportResult> {
  const startTime = Date.now();
  const result = emptyResult("helicone");

  try {
    let data: HeliconeRequestRow[];
    if (typeof raw === "string") {
      data = JSON.parse(raw);
    } else {
      data = raw as HeliconeRequestRow[];
    }
    if (!Array.isArray(data)) data = [data as HeliconeRequestRow];

    for (const row of data) {
      try {
        const model = row.request_model || row.response_model || "unknown";
        const totalTokens = row.total_tokens || 0;
        await ingestGatewayRecord({
          userId,
          requestId: `helicone_${row.request_id || crypto.randomUUID()}`,
          model,
          provider: "openai",
          decision: "allowed",
          promptTokens: row.prompt_tokens || 0,
          completionTokens: row.completion_tokens || 0,
          totalTokens,
          promptFingerprint: "helicone-import",
          latencyMs: row.latency || 0,
          timestamp: row.request_created_at ? new Date(row.request_created_at) : new Date(),
        });

        result.gatewayLogsImported++;
        if (totalTokens > 0) result.tokenUsageImported++;
        result.recordsImported++;
      } catch (err) {
        result.recordsSkipped++;
        result.errors.push(`Row ${result.recordsImported + 1}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    result.errors.push(`Parse error: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  logComplete(userId, "helicone", result);
  return result;
}

// ── Portkey Import ───────────────────────────────────────────────────────────

interface PortkeyLogRow {
  traceId?: string;
  requestTimestamp?: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
  latency?: number;
  status?: string;
}

export async function importPortkey(userId: number, raw: string | object): Promise<ImportResult> {
  const startTime = Date.now();
  const result = emptyResult("portkey");

  try {
    let data: PortkeyLogRow[];
    if (typeof raw === "string") {
      data = JSON.parse(raw);
    } else {
      data = raw as PortkeyLogRow[];
    }
    if (!Array.isArray(data)) data = [data as PortkeyLogRow];

    for (const row of data) {
      try {
        const model = row.model || "unknown";
        const totalTokens = row.totalTokens || 0;
        await ingestGatewayRecord({
          userId,
          requestId: `portkey_${row.traceId || crypto.randomUUID()}`,
          model,
          provider: row.provider || "openai",
          decision: row.status === "error" ? "errored" : "allowed",
          promptTokens: row.promptTokens || 0,
          completionTokens: row.completionTokens || 0,
          totalTokens,
          promptFingerprint: "portkey-import",
          latencyMs: row.latency || 0,
          timestamp: row.requestTimestamp ? new Date(row.requestTimestamp) : new Date(),
        });

        result.gatewayLogsImported++;
        if (totalTokens > 0) result.tokenUsageImported++;
        result.recordsImported++;
      } catch (err) {
        result.recordsSkipped++;
        result.errors.push(`Row ${result.recordsImported + 1}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    result.errors.push(`Parse error: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  logComplete(userId, "portkey", result);
  return result;
}

// ── Lakera Guard Import ──────────────────────────────────────────────────────

interface LakeraPolicyExport {
  policy_name?: string;
  thresholds?: {
    injection?: number;
    jailbreak?: number;
    toxicity?: number;
    pii?: number;
    data_loss?: number;
  };
  blocklists?: string[];
  allowlists?: string[];
  enabled_checks?: string[];
}

export async function importLakera(userId: number, raw: string | object): Promise<ImportResult> {
  const startTime = Date.now();
  const result = emptyResult("lakera");

  try {
    let policy: LakeraPolicyExport;
    if (typeof raw === "string") {
      policy = JSON.parse(raw);
    } else {
      policy = raw as LakeraPolicyExport;
    }

    const allowlistYaml = (policy.allowlists || []).map((item) => `  - "${item}"`).join("\n");
    const blocklistYaml = (policy.blocklists || []).map((item) => `  - "${item}"`).join("\n");

    const yamlPolicy = `# Auto-generated from Lakera Guard import
# Original policy: ${policy.policy_name || "Unnamed"}
# Imported at: ${new Date().toISOString()}

name: imported-from-lakera
version: "1.0"
enabled: true

pii_redaction:
  enabled: ${policy.enabled_checks?.includes("pii") || policy.thresholds?.pii !== undefined ? "true" : "false"}
  rules:
    - email
    - credit_card
    - ssn
    - phone
    - ip_address

prompt_injection:
  enabled: ${policy.enabled_checks?.includes("injection") || policy.thresholds?.injection !== undefined ? "true" : "false"}
  threshold: ${policy.thresholds?.injection || 0.7}
  block_on_critical: true

content_filter:
  enabled: ${policy.enabled_checks?.includes("toxicity") || policy.thresholds?.toxicity !== undefined ? "true" : "false"}
  toxicity_threshold: ${policy.thresholds?.toxicity || 0.7}

allowlist:
${allowlistYaml || "  []"}

blocklist:
${blocklistYaml || "  []"}
`;

    await db.createTenantPolicy({
      userId,
      yaml: yamlPolicy,
      compiled: policy,
      enabled: true,
      appliesTo: "all",
    } as any);

    result.policiesImported = 1;
    result.recordsImported = 1;
  } catch (err) {
    result.errors.push(`Lakera policy import error: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  logComplete(userId, "lakera", result);
  return result;
}

// ── LangSmith Import ─────────────────────────────────────────────────────────

interface LangSmithRun {
  id?: string;
  run_type?: string;
  start_time?: string;
  outputs?: Record<string, unknown>;
  error?: string;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  latency?: number;
  cost?: number;
}

export async function importLangSmith(userId: number, raw: string | object): Promise<ImportResult> {
  const startTime = Date.now();
  const result = emptyResult("langsmith");

  try {
    let data: LangSmithRun[];
    if (typeof raw === "string") {
      data = JSON.parse(raw);
    } else {
      data = raw as LangSmithRun[];
    }
    if (!Array.isArray(data)) data = [data as LangSmithRun];

    for (const run of data) {
      try {
        if (run.run_type && !run.run_type.includes("llm") && run.run_type !== "chain") {
          result.recordsSkipped++;
          continue;
        }

        const model = (run.outputs as any)?.model || "unknown";
        const totalTokens = run.total_tokens || 0;
        await ingestGatewayRecord({
          userId,
          requestId: `langsmith_${run.id || crypto.randomUUID()}`,
          model,
          provider: "openai",
          decision: run.error ? "errored" : "allowed",
          promptTokens: run.prompt_tokens || 0,
          completionTokens: run.completion_tokens || 0,
          totalTokens,
          promptFingerprint: "langsmith-import",
          latencyMs: run.latency || 0,
          timestamp: run.start_time ? new Date(run.start_time) : new Date(),
        });

        result.gatewayLogsImported++;
        if (totalTokens > 0) result.tokenUsageImported++;
        result.recordsImported++;
      } catch (err) {
        result.recordsSkipped++;
      }
    }
  } catch (err) {
    result.errors.push(`LangSmith parse error: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  logComplete(userId, "langsmith", result);
  return result;
}

// ── Universal CSV Import ─────────────────────────────────────────────────────

export interface ColumnMapping {
  targetField:
    | "model"
    | "provider"
    | "promptTokens"
    | "completionTokens"
    | "totalTokens"
    | "costUSD"
    | "latencyMs"
    | "timestamp"
    | "status"
    | "decision"
    | "requestId"
    | "userId"
    | "skip";
  sourceColumn: string;
}

export async function importUniversalCSV(
  userId: number,
  csvContent: string,
  columnMapping: ColumnMapping[],
): Promise<ImportResult> {
  const startTime = Date.now();
  const result = emptyResult("universal_csv");

  try {
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      result.errors.push("CSV must have a header row and at least one data row");
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const headers = parseCSVLine(lines[0]);

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      try {
        const getValue = (field: ColumnMapping["targetField"]): string => {
          for (const m of columnMapping) {
            if (m.targetField === field && row[m.sourceColumn]) return row[m.sourceColumn];
          }
          return "";
        };

        const model = getValue("model") || "unknown";
        const totalTokens = parseInt(getValue("totalTokens") || "0", 10);
        const latencyMs = parseInt(getValue("latencyMs") || "0", 10);
        const timestamp = getValue("timestamp") ? new Date(getValue("timestamp")) : new Date();

        await ingestGatewayRecord({
          userId,
          requestId: `csv_${crypto.randomUUID()}`,
          model,
          provider: getValue("provider") || "openai",
          decision: getValue("decision") === "blocked" ? "blocked" : "allowed",
          promptTokens: parseInt(getValue("promptTokens") || "0", 10),
          completionTokens: parseInt(getValue("completionTokens") || "0", 10),
          totalTokens,
          promptFingerprint: "csv-import",
          latencyMs,
          timestamp,
        });

        result.gatewayLogsImported++;
        if (totalTokens > 0) result.tokenUsageImported++;
        result.recordsImported++;
      } catch (err) {
        result.recordsSkipped++;
        result.errors.push(`Row ${i + 1}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    result.errors.push(`CSV parse error: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  logComplete(userId, "universal_csv", result);
  return result;
}

// ── Universal JSON Import ───────────────────────────────────────────────────

export async function importUniversalJSON(
  userId: number,
  jsonContent: string | object,
  arrayPath?: string,
): Promise<ImportResult> {
  const startTime = Date.now();
  const result = emptyResult("universal_json");

  try {
    let root: any;
    if (typeof jsonContent === "string") {
      root = JSON.parse(jsonContent);
    } else {
      root = jsonContent;
    }

    let data: any[] = [];
    if (arrayPath) {
      const parts = arrayPath.split(".");
      let current = root;
      for (const part of parts) {
        current = current?.[part];
      }
      data = Array.isArray(current) ? current : [current].filter(Boolean);
    } else if (Array.isArray(root)) {
      data = root;
    } else if (root.data && Array.isArray(root.data)) {
      data = root.data;
    } else {
      data = [root];
    }

    for (const row of data) {
      if (!row || typeof row !== "object") {
        result.recordsSkipped++;
        continue;
      }

      try {
        const model = row.model || row.request_model || row.response_model || "unknown";
        const promptTokens = parseInt(row.prompt_tokens || row.promptTokens || "0", 10);
        const completionTokens = parseInt(row.completion_tokens || row.completionTokens || "0", 10);
        const totalTokens =
          parseInt(row.total_tokens || row.totalTokens || "0", 10) ||
          promptTokens + completionTokens;
        const latencyMs = parseInt(row.latency || row.latencyMs || row.latency_ms || "0", 10);
        const timestamp =
          row.timestamp || row.created_at || row.createdAt
            ? new Date(row.timestamp || row.created_at || row.createdAt)
            : new Date();

        await ingestGatewayRecord({
          userId,
          requestId: `json_${row.id || crypto.randomUUID()}`,
          model,
          provider: row.provider || "unknown",
          decision:
            row.decision === "blocked" ? "blocked" : row.status === "error" ? "errored" : "allowed",
          promptTokens,
          completionTokens,
          totalTokens,
          promptFingerprint: "json-import",
          latencyMs,
          timestamp,
        });

        result.gatewayLogsImported++;
        if (totalTokens > 0) result.tokenUsageImported++;
        result.recordsImported++;
      } catch (err) {
        result.recordsSkipped++;
      }
    }
  } catch (err) {
    result.errors.push(`JSON parse error: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  logComplete(userId, "universal_json", result);
  return result;
}

// ── Collection-format imports (Postman / OpenAPI / Insomnia / Bruno) ─────────

/**
 * Convert an Insomnia v4 export into a Postman-shaped collection so it can go
 * through the same secure parser + scanners as every other collection format.
 */
export function convertInsomniaToCollection(raw: string | object): Record<string, unknown> {
  const root: any = typeof raw === "string" ? JSON.parse(raw) : raw;
  const resources: any[] = Array.isArray(root?.resources) ? root.resources : [];
  const requests = resources.filter((r) => r?._type === "request");

  const item = requests.map((r) => {
    const headers = Array.isArray(r.headers)
      ? r.headers.map((h: any) => ({ key: h.name ?? h.key ?? "", value: h.value ?? "" }))
      : [];
    return {
      name: r.name || r.url || "request",
      request: {
        method: (r.method || "GET").toUpperCase(),
        url: { raw: typeof r.url === "string" ? r.url : "" },
        header: headers,
        ...(r.body?.text ? { body: { mode: "raw", raw: r.body.text } } : {}),
      },
    };
  });

  return {
    info: {
      name: root?.__export_source ? "Insomnia Import" : "Insomnia Import",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item,
  };
}

const COLLECTION_STORAGE_FORMATS = new Set(["postman", "openapi", "bruno"]);

/**
 * Import a collection/API-spec format (Postman v2.1, OpenAPI, Insomnia, Bruno),
 * persist it as a real collection, and run the same credential + gateway
 * security scans the interactive importer runs. This is the migration path for
 * "bring your API collection from tool X".
 */
export async function importCollectionSpec(
  userId: number,
  source: "postman" | "openapi" | "insomnia" | "bruno",
  raw: string | object,
  name?: string,
): Promise<ImportResult> {
  const startTime = Date.now();
  const result = emptyResult(source);

  try {
    let rawText: string;
    let forceYaml = false;

    if (source === "insomnia") {
      rawText = JSON.stringify(convertInsomniaToCollection(raw));
    } else if (typeof raw === "string") {
      rawText = raw;
      forceYaml =
        source === "openapi" &&
        !rawText.trimStart().startsWith("{") &&
        !rawText.trimStart().startsWith("[");
    } else {
      rawText = JSON.stringify(raw);
    }

    const parsed = parseCollectionImport(rawText, {
      filename: `${name ?? source}.${forceYaml ? "yaml" : "json"}`,
      forceYaml: forceYaml || source === "openapi",
    });

    if (parsed.errors.length > 0) {
      result.errors.push(...parsed.errors);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    const storageFormat = COLLECTION_STORAGE_FORMATS.has(parsed.storageFormat)
      ? (parsed.storageFormat as "postman" | "openapi" | "bruno")
      : "postman";

    // Scope to the caller's personal workspace so tenant checks pass cleanly.
    let workspaceId: number | undefined;
    try {
      const ws = await ensurePersonalWorkspace(userId, null);
      workspaceId = ws.id;
    } catch {
      workspaceId = undefined;
    }

    const collectionName = name || parsed.name || `Imported from ${source}`;
    const col = await db.createCollection(
      userId,
      collectionName,
      storageFormat,
      parsed.data,
      undefined,
      {
        contentHash: parsed.contentHash,
        tags: parsed.tags,
        totalRequests: parsed.endpointCount,
        workspaceId,
      },
    );

    result.collectionsCreated = 1;
    result.collectionId = (col as { id?: string })?.id;
    result.recordsImported = parsed.endpointCount;
    result.scannedImports = true;

    try {
      const cred = scanCollectionForCredentials(parsed.data);
      result.credentialFindings = cred.length;
      const gw = scanCollectionForGateway(parsed.data);
      result.gatewayFindings = gw.findings.length;
    } catch (err) {
      result.errors.push(`Scan warning: ${(err as Error).message}`);
    }
  } catch (err) {
    result.errors.push(`${source} import error: ${(err as Error).message}`);
  }

  result.durationMs = Date.now() - startTime;
  logComplete(userId, source, result);
  return result;
}

// ── Preview ─────────────────────────────────────────────────────────────────

export function previewImport(source: ImportSource, raw: string | object): ImportPreview {
  const preview: ImportPreview = {
    source,
    detectedFormat: source,
    recordCount: 0,
    sampleRows: [],
    columns: [],
    estimatedCollectionsImport: 0,
    estimatedGatewayLogsImport: 0,
    warnings: [],
  };

  try {
    let data: any;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch {
        const lines = raw.trim().split("\n");
        if (lines.length > 0) {
          preview.columns = parseCSVLine(lines[0]);
          preview.recordCount = Math.max(0, lines.length - 1);
          preview.sampleRows = lines.slice(1, Math.min(4, lines.length)).map((line) => {
            const vals = parseCSVLine(line);
            const obj: Record<string, unknown> = {};
            preview.columns.forEach((col, idx) => {
              obj[col] = vals[idx] || "";
            });
            return obj;
          });
          preview.estimatedGatewayLogsImport = preview.recordCount;
          preview.detectedFormat = "csv";
          if (preview.columns.length === 0) {
            preview.warnings.push("No headers detected in CSV");
          }
        }
        preview.detectedFormat = "csv";
        return preview;
      }
    } else {
      data = raw;
    }

    if (Array.isArray(data)) {
      preview.recordCount = data.length;
      preview.sampleRows = data.slice(0, 3);
      if (data.length > 0 && typeof data[0] === "object") {
        preview.columns = Object.keys(data[0]);
      }
      preview.estimatedGatewayLogsImport = data.length;
    } else if (data && typeof data === "object") {
      preview.recordCount = 1;
      preview.sampleRows = [data];
      preview.columns = Object.keys(data);
      preview.estimatedGatewayLogsImport = 1;
    }

    const hasTimestamp = preview.columns.some(
      (c) =>
        c.includes("timestamp") ||
        c.includes("created_at") ||
        c.includes("time") ||
        c.includes("date"),
    );
    if (!hasTimestamp) {
      preview.warnings.push("No timestamp column detected — all records will use current time");
    }
  } catch (err) {
    preview.warnings.push(`Preview error: ${(err as Error).message}`);
  }

  return preview;
}

// ── CSV Helper ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
