import type { NormalizedCollection, NormalizedEndpoint, NormalizedHeader } from "./types.js";

interface PostmanHeader {
  key?: string;
  value?: string;
}

interface PostmanRequest {
  method?: string;
  url?: string | { raw?: string; query?: Array<{ key?: string }> };
  header?: PostmanHeader[];
}

interface PostmanItem {
  request?: PostmanRequest;
  name?: string;
  item?: PostmanItem[];
}

interface OpenApiOperation {
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{ in?: string; name?: string }>;
}

function extractUrl(req: PostmanRequest | undefined): string {
  if (!req?.url) return "";
  if (typeof req.url === "string") return req.url;
  return req.url.raw || "";
}

function extractQueryKeys(req: PostmanRequest | undefined): string[] {
  if (!req?.url || typeof req.url === "string") {
    const raw = typeof req?.url === "string" ? req.url : "";
    try {
      const full = raw.startsWith("http")
        ? raw
        : `https://example.com${raw.startsWith("/") ? raw : `/${raw}`}`;
      const u = new URL(full);
      const keys: string[] = [];
      u.searchParams.forEach((_value, key) => {
        keys.push(key);
      });
      return keys;
    } catch {
      return [];
    }
  }
  return (req.url.query ?? [])
    .map((q) => q.key)
    .filter((k): k is string => typeof k === "string" && k.length > 0);
}

export function safeGetPath(rawUrl: string): string {
  if (!rawUrl) return "/";
  try {
    const fullUrl = rawUrl.startsWith("http")
      ? rawUrl
      : `https://example.com${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
    return new URL(fullUrl).pathname || "/";
  } catch {
    const q = rawUrl.indexOf("?");
    const base = q >= 0 ? rawUrl.slice(0, q) : rawUrl;
    return base.startsWith("/") ? base : `/${base}`;
  }
}

function mapHeaders(headers: PostmanHeader[] | undefined): NormalizedHeader[] {
  return (headers ?? [])
    .filter((h) => typeof h.key === "string" && h.key.length > 0)
    .map((h) => ({
      key: h.key as string,
      value: typeof h.value === "string" ? h.value : "",
    }));
}

function flattenPostmanItems(items: PostmanItem[]): PostmanItem[] {
  const out: PostmanItem[] = [];
  for (const item of items) {
    if (item.item && item.item.length > 0) {
      out.push(...flattenPostmanItems(item.item));
    } else if (item.request) {
      out.push(item);
    }
  }
  return out;
}

function fromPostman(data: { item?: PostmanItem[] }): NormalizedEndpoint[] {
  const items = flattenPostmanItems(data.item ?? []);
  return items.map((item) => {
    const url = extractUrl(item.request);
    const method = (item.request?.method || "GET").toUpperCase();
    return {
      url,
      path: safeGetPath(url),
      method,
      headers: mapHeaders(item.request?.header),
      queryKeys: extractQueryKeys(item.request),
      source: "postman" as const,
      name: item.name,
    };
  });
}

function fromOpenApi(data: {
  paths?: Record<string, Record<string, OpenApiOperation>>;
  security?: Array<Record<string, string[]>>;
}): NormalizedEndpoint[] {
  const endpoints: NormalizedEndpoint[] = [];
  const globalSecurity = data.security && data.security.length > 0;
  const paths = data.paths ?? {};

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [httpMethod, operation] of Object.entries(pathItem)) {
      const method = httpMethod.toLowerCase();
      if (!["get", "post", "put", "delete", "patch", "head", "options"].includes(method)) {
        continue;
      }
      const op = operation as OpenApiOperation;
      const queryKeys = (op.parameters ?? [])
        .filter((p) => p.in === "query" && typeof p.name === "string")
        .map((p) => p.name as string);
      const hasDeclaredSecurity =
        (op.security && op.security.length > 0) || Boolean(globalSecurity);

      endpoints.push({
        url: pathStr,
        path: pathStr.split("?")[0] || pathStr,
        method: method.toUpperCase(),
        headers: [],
        queryKeys,
        hasDeclaredSecurity,
        source: "openapi",
      });
    }
  }
  return endpoints;
}

/**
 * Normalize Postman Collection v2/v2.1 or OpenAPI 3.x documents into endpoints.
 */
export function normalizeCollection(raw: unknown): NormalizedCollection {
  if (!raw || typeof raw !== "object") {
    return { endpoints: [], format: "empty", raw };
  }

  const data = raw as Record<string, unknown>;
  const hasPostman = Array.isArray(data.item);
  const hasOpenApi = data.paths != null && typeof data.paths === "object";

  const endpoints: NormalizedEndpoint[] = [];
  if (hasPostman) {
    endpoints.push(...fromPostman(data as { item?: PostmanItem[] }));
  }
  if (hasOpenApi) {
    endpoints.push(
      ...fromOpenApi(
        data as {
          paths?: Record<string, Record<string, OpenApiOperation>>;
          security?: Array<Record<string, string[]>>;
        },
      ),
    );
  }

  let format: NormalizedCollection["format"] = "empty";
  if (hasPostman && hasOpenApi) format = "mixed";
  else if (hasPostman) format = "postman";
  else if (hasOpenApi) format = "openapi";

  return { endpoints, format, raw };
}

export function hasAuthHeader(headers: NormalizedHeader[]): boolean {
  return headers.some((h) => {
    const k = h.key.toLowerCase();
    return (
      k.includes("authorization") ||
      k.includes("x-api-key") ||
      k === "api-key" ||
      k === "x-auth-token"
    );
  });
}

export function fingerprint(ruleId: string, method: string, path: string): string {
  return `${ruleId}|${method.toUpperCase()}|${path}`;
}
