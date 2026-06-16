/**
 * Bruno Collection Import Parser
 *
 * Bruno (https://www.usebruno.com/) is an open-source API client
 * gaining rapid adoption. Supporting Bruno imports expands our
 * addressable market and reduces friction for developers migrating
 * from Postman.
 *
 * Bruno collection format:
 *   - Collection folder with `bruno.json` metadata
 *   - Each request is a `.bru` file (plain text, not JSON)
 *   - Environment files are `.json` with `vars[]` array
 *
 * This parser handles the JSON export format (when users export
 * as "Bruno Collection JSON").
 */

export interface BrunoRequest {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  auth?: {
    type: "none" | "basic" | "bearer";
    username?: string;
    password?: string;
    token?: string;
  };
}

export interface BrunoCollection {
  name: string;
  version: string;
  items: BrunoRequest[];
}

export interface BrunoImportResult {
  name: string;
  totalRequests: number;
  requests: BrunoRequest[];
  warnings: string[];
}

/**
 * Parse a Bruno collection JSON export.
 * Validates structure and extracts request definitions.
 */
export function parseBrunoCollection(raw: string): BrunoImportResult {
  let collection: unknown;
  try {
    collection = JSON.parse(raw);
  } catch {
    throw new Error("Invalid Bruno collection: not valid JSON");
  }

  if (!collection || typeof collection !== "object") {
    throw new Error("Invalid Bruno collection: expected JSON object");
  }

  const col = collection as Record<string, unknown>;

  const name = typeof col.name === "string" ? col.name : "Imported Collection";
  const items = Array.isArray(col.items) ? col.items : [];

  const requests: BrunoRequest[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      warnings.push("Skipped non-object item in collection");
      continue;
    }

    const req = item as Record<string, unknown>;

    const method = normalizeMethod(req.method);
    const url = extractUrl(req.url);
    if (!url) {
      warnings.push(`Skipped request "${req.name}": missing URL`);
      continue;
    }

    const headers = extractHeaders(req.headers);
    const body = typeof req.body === "string" ? req.body : undefined;
    const auth = extractAuth(req.auth);

    requests.push({
      name: typeof req.name === "string" ? req.name : `Request ${requests.length + 1}`,
      method,
      url,
      headers,
      body,
      auth,
    });
  }

  // Check for credentials in headers/body (security scan)
  for (const req of requests) {
    for (const [key, value] of Object.entries(req.headers)) {
      if (looksLikeSecret(key, value)) {
        warnings.push(`Potential secret in header "${key}" of request "${req.name}"`);
      }
    }
    if (req.body && looksLikeSecretInBody(req.body)) {
      warnings.push(`Potential secret in body of request "${req.name}"`);
    }
    if (req.auth?.token && req.auth.token.length > 10) {
      warnings.push(`Bearer token exposed in request "${req.name}"`);
    }
  }

  return {
    name,
    totalRequests: requests.length,
    requests,
    warnings,
  };
}

function normalizeMethod(method: unknown): string {
  const m = typeof method === "string" ? method.toUpperCase() : "GET";
  const valid = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  return valid.includes(m) ? m : "GET";
}

function extractUrl(url: unknown): string | undefined {
  if (typeof url === "string") return url;
  if (url && typeof url === "object") {
    const u = url as Record<string, unknown>;
    if (typeof u.raw === "string") return u.raw;
    if (typeof u.host === "string" && typeof u.path === "string") {
      return `${u.host}${u.path}`;
    }
  }
  return undefined;
}

function extractHeaders(headers: unknown): Record<string, string> {
  if (!Array.isArray(headers)) return {};
  const result: Record<string, string> = {};
  for (const h of headers) {
    if (h && typeof h === "object") {
      const header = h as Record<string, unknown>;
      const key = typeof header.name === "string" ? header.name : String(header.key ?? "");
      const value = typeof header.value === "string" ? header.value : String(header.value ?? "");
      if (key) result[key] = value;
    }
  }
  return result;
}

function extractAuth(auth: unknown): BrunoRequest["auth"] {
  if (!auth || typeof auth !== "object") return { type: "none" };
  const a = auth as Record<string, unknown>;
  const type = a.type === "basic" || a.type === "bearer" ? a.type : "none";
  return {
    type,
    username: typeof a.username === "string" ? a.username : undefined,
    password: typeof a.password === "string" ? a.password : undefined,
    token: typeof a.token === "string" ? a.token : undefined,
  };
}

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /bearer/i,
  /password/i,
  /secret/i,
  /private[_-]?key/i,
  /aws[_-]?access/i,
  /github[_-]?token/i,
];

function looksLikeSecret(key: string, value: string): boolean {
  if (!value || value.length < 8) return false;
  return SECRET_PATTERNS.some((p) => p.test(key) || p.test(value));
}

function looksLikeSecretInBody(body: string): boolean {
  if (body.length < 20) return false;
  return SECRET_PATTERNS.some((p) => p.test(body));
}
