/**
 * Secure collection import parsers.
 * - OpenAPI 3 JSON/YAML, Swagger 2, Postman v2 / v2.1
 * - Size limits, recursion depth, YAML bomb guards, no external $ref fetch
 */
import crypto from "crypto";
import { parse as yamlParse } from "yaml";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_RECURSION_DEPTH = 32;
export const MAX_YAML_ALIASES = 50;
export const MAX_OBJECT_KEYS = 50_000;

export type ImportFormat =
  "openapi3" | "swagger2" | "postman_v2" | "postman_v2.1" | "bruno" | "unknown";

export type NormalizedImportFormat = "postman" | "openapi" | "bruno";

export interface ImportParseResult {
  format: ImportFormat;
  storageFormat: NormalizedImportFormat;
  data: Record<string, unknown>;
  contentHash: string;
  name: string;
  warnings: string[];
  errors: string[];
  endpointCount: number;
  secretsRedacted: number;
  tags: string[];
}

export class ImportSecurityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ImportSecurityError";
  }
}

/** Count keys recursively with depth/size guards. */
export function assertSafeStructure(value: unknown, depth = 0, counters = { keys: 0 }): void {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new ImportSecurityError(
      "MAX_DEPTH",
      `Document exceeds maximum nesting depth (${MAX_RECURSION_DEPTH})`,
    );
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      assertSafeStructure(item, depth + 1, counters);
    }
    return;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new ImportSecurityError("PROTOTYPE_POLLUTION", "Prohibited object key");
    }
    counters.keys += 1;
    if (counters.keys > MAX_OBJECT_KEYS) {
      throw new ImportSecurityError(
        "MAX_KEYS",
        `Document exceeds maximum key count (${MAX_OBJECT_KEYS})`,
      );
    }
    assertSafeStructure(obj[key], depth + 1, counters);
  }
}

/**
 * Parse YAML with bomb protections:
 * - max document size
 * - max alias count (via unique anchors tracking)
 * - no custom tags that execute code (yaml package default)
 */
export function secureParseYaml(text: string): unknown {
  if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) {
    throw new ImportSecurityError("FILE_TOO_LARGE", `YAML exceeds ${MAX_IMPORT_BYTES} bytes`);
  }
  // Reject obvious bomb patterns: excessive repeated anchors
  const aliasMatches = text.match(/&\w+/g) ?? [];
  if (aliasMatches.length > MAX_YAML_ALIASES) {
    throw new ImportSecurityError(
      "YAML_BOMB",
      `Too many YAML anchors (${aliasMatches.length} > ${MAX_YAML_ALIASES})`,
    );
  }
  const aliasUses = text.match(/\*\w+/g) ?? [];
  if (aliasUses.length > MAX_YAML_ALIASES * 2) {
    throw new ImportSecurityError("YAML_BOMB", "Excessive YAML alias references blocked");
  }

  let doc: unknown;
  try {
    doc = yamlParse(text, {
      maxAliasCount: MAX_YAML_ALIASES,
      prettyErrors: true,
    });
  } catch (err) {
    throw new ImportSecurityError("YAML_PARSE_ERROR", `Malformed YAML: ${(err as Error).message}`);
  }
  assertSafeStructure(doc);
  return doc;
}

export function secureParseJson(text: string): unknown {
  if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) {
    throw new ImportSecurityError("FILE_TOO_LARGE", `JSON exceeds ${MAX_IMPORT_BYTES} bytes`);
  }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    throw new ImportSecurityError("JSON_PARSE_ERROR", `Malformed JSON: ${(err as Error).message}`);
  }
  assertSafeStructure(doc);
  return doc;
}

/** Detect format from parsed object. */
export function detectFormat(data: unknown): ImportFormat {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "unknown";
  const d = data as Record<string, unknown>;
  if (typeof d.openapi === "string" && d.openapi.startsWith("3.")) return "openapi3";
  if (d.swagger === "2.0" || d.swagger === 2) return "swagger2";
  if (typeof d.openapi === "string") return "openapi3";
  const info = d.info as Record<string, unknown> | undefined;
  const schema = typeof info?.schema === "string" ? info.schema : "";
  if (schema.includes("collection/v2.1.0") || schema.includes("v2.1")) return "postman_v2.1";
  if (schema.includes("collection/v2.0") || schema.includes("v2.0")) return "postman_v2";
  if (Array.isArray(d.item) || info?._postman_id) return "postman_v2.1";
  if (d.brunoConfig || d.seq) return "bruno";
  if (d.paths && typeof d.paths === "object") return "openapi3";
  return "unknown";
}

export function toStorageFormat(format: ImportFormat): NormalizedImportFormat {
  if (format === "bruno") return "bruno";
  if (format === "postman_v2" || format === "postman_v2.1") return "postman";
  return "openapi";
}

/**
 * Block external $ref SSRF: reject http(s) refs; strip or flag others.
 * We never fetch remote references.
 */
export function stripExternalRefs(value: unknown, warnings: string[], depth = 0): unknown {
  if (depth > MAX_RECURSION_DEPTH) return value;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripExternalRefs(v, warnings, depth + 1));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "$ref" && typeof v === "string") {
      if (/^https?:\/\//i.test(v) || v.startsWith("//") || /^file:/i.test(v)) {
        warnings.push(`Blocked external $ref: ${v.slice(0, 120)}`);
        out[k] = "#/blocked-external-ref";
        continue;
      }
      // Local refs (#/...) and relative paths kept but never resolved remotely
      out[k] = v;
      continue;
    }
    out[k] = stripExternalRefs(v, warnings, depth + 1);
  }
  return out;
}

const SECRET_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "aws_key", re: /AKIA[0-9A-Z]{16}/g },
  { id: "github_pat", re: /ghp_[A-Za-z0-9]{36,}/g },
  { id: "openai", re: /sk-[A-Za-z0-9]{20,}/g },
  { id: "bearer", re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi },
  {
    id: "generic_secret",
    re: /(?:"|')?(?:api[_-]?key|secret|password|token)(?:"|')?\s*[:=]\s*(?:"|')([^"'\s]{8,})(?:"|')/gi,
  },
];

/** Redact secrets in-place (returns count). */
export function redactSecrets(value: unknown, depth = 0): number {
  if (depth > MAX_RECURSION_DEPTH) return 0;
  let count = 0;
  if (typeof value === "string") {
    // leaf handled by parent
    return 0;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] === "string") {
        const { text, n } = redactString(value[i] as string);
        if (n > 0) {
          value[i] = text;
          count += n;
        }
      } else {
        count += redactSecrets(value[i], depth + 1);
      }
    }
    return count;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === "string") {
        const { text, n } = redactString(obj[k] as string);
        if (n > 0) {
          obj[k] = text;
          count += n;
        }
      } else {
        count += redactSecrets(obj[k], depth + 1);
      }
    }
  }
  return count;
}

function redactString(s: string): { text: string; n: number } {
  let text = s;
  let n = 0;
  for (const { re } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    const before = text;
    text = text.replace(re, (m) => {
      n += 1;
      if (m.length <= 8) return "***REDACTED***";
      return `${m.slice(0, 4)}…***REDACTED***`;
    });
    if (text !== before) {
      // continue other patterns
    }
  }
  return { text, n };
}

function countEndpoints(data: Record<string, unknown>, format: ImportFormat): number {
  if (format.startsWith("postman") && Array.isArray(data.item)) {
    const walk = (items: unknown[], depth = 0): number => {
      if (depth > MAX_RECURSION_DEPTH) return 0;
      let n = 0;
      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const o = it as Record<string, unknown>;
        if (Array.isArray(o.item)) n += walk(o.item, depth + 1);
        else if (o.request) n += 1;
      }
      return n;
    };
    return walk(data.item);
  }
  if (data.paths && typeof data.paths === "object") {
    let n = 0;
    for (const pathItem of Object.values(data.paths as Record<string, unknown>)) {
      if (!pathItem || typeof pathItem !== "object") continue;
      for (const m of Object.keys(pathItem as object)) {
        if (
          ["get", "post", "put", "delete", "patch", "head", "options"].includes(m.toLowerCase())
        ) {
          n += 1;
        }
      }
    }
    return n;
  }
  return 0;
}

function extractName(
  data: Record<string, unknown>,
  format: ImportFormat,
  fallback: string,
): string {
  const info = data.info as Record<string, unknown> | undefined;
  if (typeof info?.title === "string") return info.title.slice(0, 255);
  if (typeof info?.name === "string") return info.name.slice(0, 255);
  if (typeof data.name === "string") return data.name.slice(0, 255);
  return fallback;
}

function extractTags(data: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) {
      if (typeof t === "string") tags.add(t.slice(0, 64));
      else if (t && typeof t === "object" && typeof (t as { name?: string }).name === "string") {
        tags.add((t as { name: string }).name.slice(0, 64));
      }
    }
  }
  return [...tags].slice(0, 32);
}

export function contentHash(data: unknown): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex");
}

/**
 * Full secure import pipeline from raw text (JSON or YAML).
 */
export function parseCollectionImport(
  rawText: string,
  options?: { filename?: string; forceYaml?: boolean },
): ImportParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const filename = options?.filename ?? "collection";
  const isYaml =
    options?.forceYaml ||
    /\.ya?ml$/i.test(filename) ||
    (!rawText.trimStart().startsWith("{") &&
      !rawText.trimStart().startsWith("[") &&
      (rawText.includes("openapi:") || rawText.includes("swagger:")));

  let parsed: unknown;
  try {
    parsed = isYaml ? secureParseYaml(rawText) : secureParseJson(rawText);
  } catch (err) {
    if (err instanceof ImportSecurityError) {
      return {
        format: "unknown",
        storageFormat: "openapi",
        data: {},
        contentHash: "",
        name: filename,
        warnings,
        errors: [`${err.code}: ${err.message}`],
        endpointCount: 0,
        secretsRedacted: 0,
        tags: [],
      };
    }
    throw err;
  }

  // Client may wrap raw YAML as { _rawYaml: "..." }
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    typeof (parsed as { _rawYaml?: string })._rawYaml === "string"
  ) {
    try {
      parsed = secureParseYaml((parsed as { _rawYaml: string })._rawYaml);
    } catch (err) {
      const msg = err instanceof ImportSecurityError ? err.message : String(err);
      errors.push(msg);
      return {
        format: "unknown",
        storageFormat: "openapi",
        data: {},
        contentHash: "",
        name: filename,
        warnings,
        errors,
        endpointCount: 0,
        secretsRedacted: 0,
        tags: [],
      };
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push("Root document must be a JSON/YAML object");
    return {
      format: "unknown",
      storageFormat: "openapi",
      data: {},
      contentHash: "",
      name: filename,
      warnings,
      errors,
      endpointCount: 0,
      secretsRedacted: 0,
      tags: [],
    };
  }

  const stripped = stripExternalRefs(parsed, warnings) as Record<string, unknown>;
  const secretsRedacted = redactSecrets(stripped);
  const format = detectFormat(stripped);
  if (format === "unknown") {
    warnings.push("Could not confidently detect format; treating as OpenAPI-like");
  }

  const storageFormat = toStorageFormat(format === "unknown" ? "openapi3" : format);
  const hash = contentHash(stripped);
  const name = extractName(stripped, format, filename.replace(/\.[^.]+$/, ""));
  const tags = extractTags(stripped);
  const endpointCount = countEndpoints(stripped, format === "unknown" ? "openapi3" : format);

  return {
    format: format === "unknown" ? "openapi3" : format,
    storageFormat,
    data: stripped,
    contentHash: hash,
    name,
    warnings,
    errors,
    endpointCount,
    secretsRedacted,
    tags,
  };
}

/** Safe minimal sample collections for demos / tests (no real secrets). */
export const SAFE_SAMPLE_COLLECTIONS = {
  postman_v21: {
    info: {
      name: "Sample Secure API",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: "Health",
        request: {
          method: "GET",
          url: "https://api.example.com/health",
          header: [{ key: "Authorization", value: "Bearer {{token}}" }],
        },
      },
    ],
  },
  openapi3: {
    openapi: "3.0.3",
    info: { title: "Sample API", version: "1.0.0" },
    paths: {
      "/health": {
        get: {
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "ok" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  },
  swagger2: {
    swagger: "2.0",
    info: { title: "Sample Swagger", version: "1.0.0" },
    paths: {
      "/pets": {
        get: {
          security: [{ api_key: [] }],
          responses: { "200": { description: "ok" } },
        },
      },
    },
    securityDefinitions: {
      api_key: { type: "apiKey", name: "X-API-Key", in: "header" },
    },
  },
} as const;
