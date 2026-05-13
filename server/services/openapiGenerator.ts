/**
 * OpenAPI 3.0 generator for our tRPC routers (Sprint 6 / Domain 4).
 *
 * tRPC doesn't ship a first-party OpenAPI exporter — `trpc-openapi` is
 * stale and pinned to old runtimes. We walk our own `appRouter._def`
 * tree and emit a usable spec ourselves. The result powers the
 * `/api-docs` portal page so customers and integration partners can
 * read the API surface without diffing source.
 *
 * What this generator covers (intentionally pragmatic):
 *  - Every query/mutation reachable from the appRouter root.
 *  - Path = `/api/trpc/<dot.path>`.
 *  - HTTP method = GET for queries, POST for mutations.
 *  - Input schema: best-effort Zod → JSON Schema. Recursively handles
 *    object / array / string / number / boolean / enum / literal /
 *    nullable / optional / union / record. Falls back to `{type:"object"}`
 *    for shapes the converter doesn't recognise. We mark those entries
 *    `x-fallback: true` so reviewers can see what's lossy.
 *  - Output schema: not extractable from tRPC at runtime (it's a
 *    TypeScript-only return-type inference). We emit a stable envelope
 *    `{result:{data:{...}}}` matching tRPC v11's HTTP wire format.
 *  - Auth: every procedure built from `protectedProcedure` is tagged
 *    with `security: [{cookieAuth: []}]`.
 *
 * What this generator does NOT cover:
 *  - Subscriptions (no SSE/websocket transport documented).
 *  - Per-router middleware narrowing of context (we only know if the
 *    proc went through `protectedProcedure`).
 *  - Examples (would require live data — out of scope here).
 */

import type {
  AnyTRPCRouter,
  AnyTRPCProcedure,
} from "@trpc/server";
import { z, type ZodTypeAny } from "zod";

export interface OpenApiSpec {
  openapi: "3.0.3";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey";
        in: "cookie";
        name: string;
        description: string;
      };
    };
  };
}

export interface OpenApiOperation {
  summary: string;
  operationId: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  parameters?: OpenApiParameter[];
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: JsonSchema }>;
  };
  responses: {
    "200": {
      description: string;
      content: Record<string, { schema: JsonSchema }>;
    };
    "401"?: { description: string };
    "400"?: { description: string };
    "500"?: { description: string };
  };
}

export interface OpenApiParameter {
  name: string;
  in: "query";
  required: boolean;
  schema: JsonSchema;
  description?: string;
}

export type JsonSchema =
  | { type: "string"; enum?: string[]; format?: string; description?: string }
  | { type: "number"; minimum?: number; maximum?: number; description?: string }
  | { type: "integer"; minimum?: number; maximum?: number; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "null" }
  | {
      type: "object";
      properties?: Record<string, JsonSchema>;
      required?: string[];
      additionalProperties?: JsonSchema | boolean;
      description?: string;
      "x-fallback"?: boolean;
    }
  | {
      type: "array";
      items: JsonSchema;
      description?: string;
    }
  | { oneOf: JsonSchema[]; description?: string }
  | { const: string | number | boolean | null }
  | { description?: string; "x-any": true };

/* ─── Zod → JSON Schema ────────────────────────────────────────────────── */

interface ConvertOpts {
  optional?: boolean;
}

export function zodToJsonSchema(zod: ZodTypeAny, _opts: ConvertOpts = {}): JsonSchema {
  // Zod v4 stores the kind in `_def.typeName` (e.g. "ZodString").
  // The shape of `_def` varies per kind (innerType, element, shape,
  // options, entries, values).
  const def = (zod as unknown as { _def?: { type?: string; typeName?: string } })._def;
  const kind = def?.typeName ?? def?.type;

  switch (kind) {
    case "ZodString":
    case "string":
      return { type: "string" };
    case "ZodNumber":
    case "number":
      return { type: "number" };
    case "ZodInt":
    case "ZodBigInt":
    case "int":
    case "bigint":
      return { type: "integer" };
    case "ZodBoolean":
    case "boolean":
      return { type: "boolean" };
    case "ZodDate":
    case "date":
      return { type: "string", format: "date-time" };
    case "ZodNull":
    case "null":
      return { type: "null" };
    case "ZodAny":
    case "ZodUnknown":
    case "ZodNever":
    case "ZodVoid":
    case "any":
    case "unknown":
    case "never":
    case "void":
      return { "x-any": true };
    case "ZodEnum":
    case "ZodNativeEnum":
    case "enum": {
      // Zod v4: `_def.values` is a flat array; v3: `_def.entries` is a Record.
      const defExt = def as unknown as {
        values?: string[];
        entries?: Record<string, string | number>;
      };
      const raw = defExt.values ?? defExt.entries;
      const enumValues = Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === "string")
        : Object.values(raw ?? {}).filter(
            (v): v is string => typeof v === "string"
          );
      return { type: "string", enum: enumValues };
    }
    case "ZodLiteral":
    case "literal": {
      // Zod v4: `_def.value` (singular); v3: `_def.values` (array).
      const defExt = def as unknown as {
        value?: unknown;
        values?: unknown[];
      };
      const value = defExt.value ?? defExt.values?.[0];
      if (value === null) return { type: "null" };
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return { const: value };
      }
      return { "x-any": true };
    }
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
    case "ZodCatch":
    case "ZodReadonly":
    case "ZodBranded":
    case "ZodPipeline":
    case "ZodLazy":
    case "optional":
    case "nullable":
    case "default":
    case "catch":
    case "readonly":
    case "branded":
    case "pipe":
    case "lazy": {
      const inner = (def as unknown as { innerType?: ZodTypeAny }).innerType;
      if (!inner) return { "x-any": true };
      return zodToJsonSchema(inner);
    }
    case "ZodArray":
    case "array": {
      // Zod v4: `_def.type` holds the inner schema; v3: `_def.element`.
      const defExt = def as unknown as {
        element?: ZodTypeAny;
        type?: ZodTypeAny;
      };
      const inner = defExt.element ?? defExt.type;
      const items = inner ? zodToJsonSchema(inner) : { "x-any": true as const };
      return { type: "array", items };
    }
    case "ZodTuple":
    case "tuple": {
      const items =
        (def as unknown as { items?: ZodTypeAny[] }).items ?? [];
      if (items.length === 0)
        return { type: "array", items: { "x-any": true } };
      return {
        type: "array",
        items: { oneOf: items.map(i => zodToJsonSchema(i)) } as JsonSchema,
      };
    }
    case "ZodObject":
    case "object": {
      const shapeRaw = (def as unknown as { shape?: unknown }).shape;
      const shape =
        typeof shapeRaw === "function"
          ? (shapeRaw as () => Record<string, ZodTypeAny>)()
          : (shapeRaw as Record<string, ZodTypeAny> | undefined);
      if (!shape) return { type: "object", "x-fallback": true };
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(child);
        const childDef = (child as unknown as { _def?: { type?: string; typeName?: string } })._def;
        const childKind = childDef?.typeName ?? childDef?.type;
        if (
          childKind !== "ZodOptional" &&
          childKind !== "optional" &&
          childKind !== "ZodDefault" &&
          childKind !== "default" &&
          childKind !== "ZodNullable" &&
          childKind !== "nullable"
        ) {
          required.push(key);
        }
      }
      const result: JsonSchema = {
        type: "object",
        properties,
        additionalProperties: false,
      };
      if (required.length > 0) {
        (result as { required?: string[] }).required = required;
      }
      return result;
    }
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
    case "union":
    case "discriminatedUnion": {
      const options =
        (def as unknown as { options?: ZodTypeAny[] }).options ?? [];
      if (options.length === 0) return { "x-any": true };
      return { oneOf: options.map(o => zodToJsonSchema(o)) };
    }
    case "ZodIntersection":
    case "intersection": {
      const left = (def as unknown as { left?: ZodTypeAny }).left;
      const right = (def as unknown as { right?: ZodTypeAny }).right;
      if (left && right) {
        return { oneOf: [zodToJsonSchema(left), zodToJsonSchema(right)] };
      }
      return { "x-any": true };
    }
    case "ZodRecord":
    case "record": {
      const valueType = (def as unknown as { valueType?: ZodTypeAny }).valueType;
      return {
        type: "object",
        additionalProperties: valueType ? zodToJsonSchema(valueType) : true,
      };
    }
    default:
      return { type: "object", "x-fallback": true };
  }
}

/* ─── Router walker ────────────────────────────────────────────────────── */

interface ProcedureEntry {
  path: string;
  procedure: AnyTRPCProcedure;
  type: "query" | "mutation" | "subscription";
  isProtected: boolean;
}

/**
 * Recursively walk a tRPC router's `_def.procedures` map and yield every
 * leaf procedure with its dotted path (e.g. `auth.me`, `policies.list`).
 */
export function walkRouter(router: AnyTRPCRouter): ProcedureEntry[] {
  const out: ProcedureEntry[] = [];

  // tRPC v11: the router carries a flat `_def.procedures` map keyed by
  // dotted paths.  Older or alternative builds keep a nested
  // `_def.record` tree.  Support both.
  const def = (router as unknown as {
    _def?: {
      procedures?: Record<string, AnyTRPCProcedure>;
      record?: Record<string, unknown>;
    };
  })._def;

  if (def?.procedures) {
    for (const [path, proc] of Object.entries(def.procedures)) {
      const procDef = (proc as unknown as {
        _def?: { type?: string; meta?: { isProtected?: boolean } };
      })._def;
      const type = (procDef?.type ?? "query") as
        | "query"
        | "mutation"
        | "subscription";
      out.push({
        path,
        procedure: proc,
        type,
        isProtected: procDef?.meta?.isProtected ?? false,
      });
    }
    return out;
  }

  if (def?.record) {
    walkRecord(def.record, "", out);
  }
  return out;
}

function walkRecord(
  record: Record<string, unknown>,
  prefix: string,
  out: ProcedureEntry[]
): void {
  for (const [key, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const childDef = (value as unknown as {
      _def?: {
        type?: string;
        record?: Record<string, unknown>;
        procedures?: Record<string, AnyTRPCProcedure>;
        meta?: { isProtected?: boolean };
      };
    })._def;

    if (!childDef) continue;

    if (childDef.type === "query" || childDef.type === "mutation") {
      out.push({
        path,
        procedure: value as AnyTRPCProcedure,
        type: childDef.type as "query" | "mutation",
        isProtected: childDef.meta?.isProtected ?? false,
      });
    } else if (childDef.record) {
      walkRecord(childDef.record, path, out);
    } else if (childDef.procedures) {
      for (const [k, p] of Object.entries(childDef.procedures)) {
        const subDef = (p as unknown as {
          _def?: { type?: string; meta?: { isProtected?: boolean } };
        })._def;
        out.push({
          path: `${path}.${k}`,
          procedure: p,
          type: (subDef?.type ?? "query") as
            | "query"
            | "mutation"
            | "subscription",
          isProtected: subDef?.meta?.isProtected ?? false,
        });
      }
    }
  }
}

function getProcedureInputs(proc: AnyTRPCProcedure): ZodTypeAny[] {
  const def = (proc as unknown as { _def?: { inputs?: ZodTypeAny[] } })._def;
  return def?.inputs ?? [];
}

/* ─── OpenAPI builder ──────────────────────────────────────────────────── */

export interface BuildSpecOptions {
  title: string;
  version: string;
  description?: string;
  serverUrl?: string;
  cookieName?: string;
  /** Override the auto-detected protected/unprotected status for known public roots. */
  publicPaths?: Set<string>;
}

export function buildOpenApiSpec(
  router: AnyTRPCRouter,
  opts: BuildSpecOptions
): OpenApiSpec {
  const procedures = walkRouter(router);
  procedures.sort((a, b) => a.path.localeCompare(b.path));

  const paths: OpenApiSpec["paths"] = {};

  for (const entry of procedures) {
    if (entry.type === "subscription") continue;

    const httpPath = `/api/trpc/${entry.path}`;
    const method = entry.type === "query" ? "get" : "post";
    const tag = entry.path.split(".")[0] ?? "general";
    const inputs = getProcedureInputs(entry.procedure);
    const inputSchema =
      inputs.length === 0
        ? null
        : inputs.length === 1
          ? zodToJsonSchema(inputs[0] as ZodTypeAny)
          : { oneOf: inputs.map(i => zodToJsonSchema(i)) } as JsonSchema;

    const isPublic = opts.publicPaths?.has(entry.path) ?? false;
    const security =
      entry.isProtected && !isPublic
        ? [{ cookieAuth: [] }]
        : undefined;

    const op: OpenApiOperation = {
      operationId: entry.path.replace(/\./g, "_"),
      summary: humanise(entry.path, entry.type),
      tags: [tag],
      ...(security ? { security } : {}),
      responses: {
        "200": {
          description: "Successful response. tRPC v11 envelope.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  result: {
                    type: "object",
                    properties: {
                      data: { "x-any": true },
                    },
                  },
                },
              } as JsonSchema,
            },
          },
        },
        "400": { description: "Validation failed (BAD_REQUEST)." },
        "401": { description: "Authentication required." },
        "500": { description: "Internal error." },
      },
    };

    if (entry.type === "query") {
      if (inputSchema) {
        op.parameters = [
          {
            name: "input",
            in: "query",
            required: true,
            schema: inputSchema,
            description:
              "URL-encoded JSON of the procedure input. tRPC v11 wire format.",
          },
        ];
      }
    } else {
      op.requestBody = {
        required: inputSchema !== null,
        content: {
          "application/json": {
            schema:
              inputSchema ??
              ({ type: "object", additionalProperties: false } as JsonSchema),
          },
        },
      };
    }

    paths[httpPath] = paths[httpPath] ?? {};
    (paths[httpPath] as Record<string, OpenApiOperation>)[method] = op;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: opts.title,
      version: opts.version,
      description:
        opts.description ??
        "Ojas Security tRPC API surface. All procedures are JSON-over-HTTP. " +
          "Query procedures (GET) take input as a URL-encoded JSON parameter; " +
          "mutation procedures (POST) take JSON request bodies. Auth is via " +
          "session cookie.",
    },
    servers: [
      {
        url: opts.serverUrl ?? "https://ojas.example.com",
        description: "Production",
      },
    ],
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: opts.cookieName ?? "session",
          description: "Session cookie issued by /auth/login.",
        },
      },
    },
  };
}

function humanise(path: string, type: "query" | "mutation" | "subscription"): string {
  const last = path.split(".").pop() ?? path;
  const camelSplit = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  const verb = type === "query" ? "Read" : "Modify";
  return `${verb}: ${camelSplit}`;
}

/**
 * Helper Zod re-export so router-walker tests don't have to also import zod.
 */
export const zodForTests = z;
