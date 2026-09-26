import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/import/preview — parse an uploaded Postman Collection (v2.1) or
 * OpenAPI-ish JSON payload and return a non-persistent summary:
 * endpoints, auth schemes in use, and a secrets-found report.
 *
 * Nothing is persisted here. Secret VALUES are never echoed back — only
 * kinds and locations. Payloads are size-capped and the scan is bounded.
 */

const MAX_BODY_BYTES = 5_000_000;
const MAX_ENDPOINTS_RETURNED = 200;
const MAX_VALUES_SCANNED = 5_000;

const PREVIEW_LIMIT = 30;
const PREVIEW_WINDOW_MS = 60_000;
const previewHits = new Map<string, number[]>();

function previewRateLimited(ip: string): boolean {
  const now = Date.now();
  const fresh = (previewHits.get(ip) ?? []).filter((t) => now - t < PREVIEW_WINDOW_MS);
  if (fresh.length >= PREVIEW_LIMIT) {
    previewHits.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  if (previewHits.size > 5000) previewHits.clear();
  previewHits.set(ip, fresh);
  return false;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

interface Endpoint {
  method: string;
  name: string;
  url: string;
}

interface AuthScheme {
  type: string;
  count: number;
  locations: string[];
}

interface SecretHit {
  kind: string;
  location: string;
}

function urlToString(url: unknown): string {
  if (typeof url === "string") return url;
  if (url && typeof url === "object") {
    const u = url as Record<string, unknown>;
    if (typeof u.raw === "string" && u.raw) return u.raw;
    const protocol = typeof u.protocol === "string" ? u.protocol : "https";
    const host = Array.isArray(u.host) ? u.host.join(".") : "";
    const path = Array.isArray(u.path) ? u.path.join("/") : "";
    if (host) return `${protocol}://${host}${path ? `/${path}` : ""}`;
  }
  return "";
}

/** Depth cap: a malicious ≤5 MB collection can nest folders thousands deep. */
const MAX_WALK_DEPTH = 32;

function walkPostmanItems(
  items: unknown,
  endpoints: Endpoint[],
  authTypes: Map<string, { count: number; locations: string[] }>,
  secretCandidates: { value: string; location: string }[],
  trail: string,
  valuesScanned: { n: number },
  depth = 0,
): void {
  if (!Array.isArray(items)) return;
  if (depth > MAX_WALK_DEPTH) throw new Error("Collection nesting too deep");
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name : "unnamed";
    const path = trail ? `${trail} / ${name}` : name;

    if (Array.isArray(item.item)) {
      collectAuth(item.auth, `folder "${path}"`, authTypes, secretCandidates, valuesScanned);
      walkPostmanItems(
        item.item,
        endpoints,
        authTypes,
        secretCandidates,
        path,
        valuesScanned,
        depth + 1,
      );
      continue;
    }

    const req = item.request;
    if (req && typeof req === "object") {
      const r = req as Record<string, unknown>;
      const method = typeof r.method === "string" ? r.method.toUpperCase() : "GET";
      endpoints.push({ method, name, url: urlToString(r.url) });

      collectAuth(r.auth, `request "${path}"`, authTypes, secretCandidates, valuesScanned);

      if (Array.isArray(r.header)) {
        for (const h of r.header) {
          if (!h || typeof h !== "object") continue;
          const hh = h as Record<string, unknown>;
          const key = typeof hh.key === "string" ? hh.key : "";
          const value = typeof hh.value === "string" ? hh.value : "";
          if (isCredentialHeader(key) && value && valuesScanned.n < MAX_VALUES_SCANNED) {
            valuesScanned.n += 1;
            secretCandidates.push({ value, location: `header "${key}" on "${path}"` });
          }
        }
      }
    }
  }
}

function collectAuth(
  auth: unknown,
  location: string,
  authTypes: Map<string, { count: number; locations: string[] }>,
  secretCandidates: { value: string; location: string }[],
  valuesScanned: { n: number },
): void {
  if (!auth || typeof auth !== "object") return;
  const a = auth as Record<string, unknown>;
  const type = typeof a.type === "string" ? a.type : "unknown";
  const entry = authTypes.get(type) ?? { count: 0, locations: [] };
  entry.count += 1;
  if (entry.locations.length < 5) entry.locations.push(location);
  authTypes.set(type, entry);

  // Auth payloads (e.g. bearer/apikey/basic params) often carry raw secrets.
  const params = (a as Record<string, unknown>)[type];
  const buckets: unknown[] = Array.isArray(params) ? params : [a];
  for (const b of buckets) {
    if (!b || typeof b !== "object") continue;
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
      if (k === "type") continue;
      const val = typeof v === "string" ? v : (v as { value?: unknown })?.value;
      if (typeof val === "string" && val && valuesScanned.n < MAX_VALUES_SCANNED) {
        valuesScanned.n += 1;
        secretCandidates.push({ value: val, location: `${type} auth (${k}) at ${location}` });
      }
    }
  }
}

function isCredentialHeader(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n === "authorization" ||
    n.includes("api-key") ||
    n.includes("apikey") ||
    n.includes("token") ||
    n === "x-auth-token" ||
    n.endsWith("-secret")
  );
}

const SECRET_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "github_token", re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { kind: "github_fine_grained_pat", re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { kind: "stripe_secret_key", re: /\b[rs]k_(live|test)_[A-Za-z0-9]{16,}\b/ },
  { kind: "openai_api_key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { kind: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { kind: "slack_token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: "generic_bearer_like", re: /^[A-Za-z0-9\-_+/=]{32,}$/ },
];

function classifySecret(value: string): string | null {
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(value)) return p.kind;
  }
  return null;
}

const SECRET_NAME_HINT = /(api[_-]?key|secret|token|password|passwd|pwd|credential)/i;

export async function POST(request: Request) {
  if (previewRateLimited(clientIp(request))) {
    return NextResponse.json({ error: "Rate limited — try again shortly." }, { status: 429 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large (5 MB max)." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  const { source, data } = body as { source?: unknown; data?: unknown };
  if (typeof source !== "string" || !source) {
    return NextResponse.json({ error: "Missing import source." }, { status: 400 });
  }
  if (!data || typeof data !== "object") {
    return NextResponse.json(
      { error: "Missing collection data — upload or paste a Postman Collection JSON." },
      { status: 400 },
    );
  }

  const collection = data as Record<string, unknown>;
  const info = (collection.info ?? {}) as Record<string, unknown>;
  const collectionName =
    typeof info.name === "string" && info.name ? info.name : "Unnamed collection";

  const endpoints: Endpoint[] = [];
  const authTypes = new Map<string, { count: number; locations: string[] }>();
  const secretCandidates: { value: string; location: string }[] = [];
  const valuesScanned = { n: 0 };
  const warnings: string[] = [];

  const isPostman =
    Array.isArray(collection.item) ||
    (typeof info.schema === "string" && info.schema.includes("getpostman.com"));

  if (isPostman) {
    collectAuth(collection.auth, "collection root", authTypes, secretCandidates, valuesScanned);
    if (Array.isArray(collection.variable)) {
      for (const v of collection.variable) {
        if (!v || typeof v !== "object") continue;
        const vv = v as Record<string, unknown>;
        const key = typeof vv.key === "string" ? vv.key : "";
        const val = typeof vv.value === "string" ? vv.value : "";
        if (val && valuesScanned.n < MAX_VALUES_SCANNED && SECRET_NAME_HINT.test(key)) {
          valuesScanned.n += 1;
          secretCandidates.push({ value: val, location: `collection variable "${key}"` });
        }
      }
    }
    try {
      walkPostmanItems(collection.item, endpoints, authTypes, secretCandidates, "", valuesScanned);
    } catch {
      return NextResponse.json({ error: "Collection nesting too deep." }, { status: 422 });
    }
  } else if (collection.openapi && typeof collection.paths === "object" && collection.paths) {
    // Minimal OpenAPI support: paths -> { get/post/...: {...} }
    const paths = collection.paths as Record<string, Record<string, unknown>>;
    for (const [p, ops] of Object.entries(paths)) {
      if (!ops || typeof ops !== "object") continue;
      for (const [method, op] of Object.entries(ops)) {
        if (!/^(get|post|put|patch|delete|head|options)$/i.test(method)) continue;
        const o = (op ?? {}) as Record<string, unknown>;
        endpoints.push({
          method: method.toUpperCase(),
          name: typeof o.operationId === "string" ? o.operationId : p,
          url: p,
        });
      }
    }
    warnings.push("OpenAPI input detected — auth/secret scan is Postman-only for now.");
  } else {
    return NextResponse.json(
      {
        error:
          "Unrecognized collection format. Expected a Postman Collection v2.1 JSON (with info/item) or an OpenAPI document (with openapi/paths).",
      },
      { status: 422 },
    );
  }

  const secretsFound: SecretHit[] = [];
  for (const c of secretCandidates) {
    const kind = classifySecret(c.value);
    if (kind) secretsFound.push({ kind, location: c.location });
  }

  const authSchemes: AuthScheme[] = [...authTypes.entries()].map(([type, v]) => ({
    type,
    count: v.count,
    locations: v.locations,
  }));

  const truncated = endpoints.length > MAX_ENDPOINTS_RETURNED;

  return NextResponse.json({
    source,
    collectionName,
    endpointCount: endpoints.length,
    endpoints: endpoints.slice(0, MAX_ENDPOINTS_RETURNED),
    authSchemes,
    secretsFound: { count: secretsFound.length, hits: secretsFound.slice(0, 50) },
    valuesScanned: valuesScanned.n,
    warnings,
    truncated,
    persisted: false,
  });
}
