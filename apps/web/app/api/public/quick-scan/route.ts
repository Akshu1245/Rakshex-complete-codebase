import { NextResponse } from "next/server";
import { isBlockedHost, validateTargetUrl } from "./guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/quick-scan — real, bounded security checks. No account needed.
 *
 * Accepts either:
 *   { url }  — fetches the URL server-side (SSRF-guarded) and reports missing
 *              security headers + exposed tech fingerprints. If the body is
 *              JSON it is additionally run through the static spec analysis.
 *   { spec } — static analysis of a pasted Postman/OpenAPI JSON document:
 *              cleartext http:// endpoints, missing auth, hardcoded secrets,
 *              sensitive paths.
 *
 * Response shape matches app/quick-scan/page.tsx. Secret values are never
 * echoed — only kinds and locations.
 */

const MAX_BODY_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_FINDINGS = 50;

const SCAN_LIMIT = 20;
const SCAN_WINDOW_MS = 60_000;
const scanHits = new Map<string, number[]>();

function scanRateLimited(ip: string): boolean {
  const now = Date.now();
  const fresh = (scanHits.get(ip) ?? []).filter((t) => now - t < SCAN_WINDOW_MS);
  if (fresh.length >= SCAN_LIMIT) {
    scanHits.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  if (scanHits.size > 5000) scanHits.clear();
  scanHits.set(ip, fresh);
  return false;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Finding {
  title: string;
  severity: Severity;
  category: string;
  endpoint?: string;
  method?: string;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 1,
};

async function fetchGuarded(url: URL): Promise<Response> {
  // Manual redirect handling so every hop is re-validated against the SSRF guard.
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    const res = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "RaksHex-QuickScan/1.0 (+https://rakshex.in)" },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel();
      let next: URL;
      try {
        next = new URL(loc, current.toString());
      } catch {
        return res;
      }
      const v = validateTargetUrl(next.toString());
      if (!v.ok) {
        await res.body?.cancel();
        throw new Error("Redirect target failed the safety check.");
      }
      current = v.url;
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects.");
}

/* ---------------- header checks ---------------- */

function checkHeaders(headers: Headers, isHttps: boolean, findings: Finding[]): void {
  const get = (n: string) => headers.get(n);

  if (isHttps && !get("strict-transport-security")) {
    findings.push({
      title:
        "Missing Strict-Transport-Security header — HTTPS can be downgraded by active attackers.",
      severity: "high",
      category: "transport",
    });
  }
  if (!get("content-security-policy")) {
    findings.push({
      title: "Missing Content-Security-Policy header — broader XSS blast radius.",
      severity: "medium",
      category: "headers",
    });
  }
  if (!get("x-content-type-options")) {
    findings.push({
      title: "Missing X-Content-Type-Options: nosniff — MIME-sniffing attacks possible.",
      severity: "low",
      category: "headers",
    });
  }
  const frame = get("x-frame-options") ?? get("content-security-policy") ?? "";
  if (!/frame-ancestors|deny|sameorigin/i.test(frame)) {
    findings.push({
      title: "No clickjacking protection (X-Frame-Options / frame-ancestors).",
      severity: "low",
      category: "headers",
    });
  }
  if (!get("referrer-policy")) {
    findings.push({
      title: "Missing Referrer-Policy header — full URLs may leak to third parties.",
      severity: "info",
      category: "headers",
    });
  }

  const server = get("server");
  if (server) {
    const versioned = /\/\d/.test(server);
    findings.push({
      title: `Server header discloses "${server}"${versioned ? " (includes version — aids targeted exploits)" : ""}.`,
      severity: versioned ? "low" : "info",
      category: "fingerprint",
    });
  }
  for (const h of ["x-powered-by", "x-aspnet-version", "x-aspnetmvc-version", "x-generator"]) {
    const v = get(h);
    if (v) {
      findings.push({
        title: `Fingerprint header ${h} discloses "${v}".`,
        severity: "info",
        category: "fingerprint",
      });
    }
  }

  const setCookie = headers.get("set-cookie");
  if (setCookie) {
    const weak: string[] = [];
    if (!/;\s*secure/i.test(`;${setCookie}`)) weak.push("Secure");
    if (!/;\s*httponly/i.test(`;${setCookie}`)) weak.push("HttpOnly");
    if (!/;\s*samesite/i.test(`;${setCookie}`)) weak.push("SameSite");
    if (weak.length > 0) {
      findings.push({
        title: `Set-Cookie missing flags: ${weak.join(", ")}.`,
        severity: "medium",
        category: "cookies",
      });
    }
  }
}

/* ---------------- static spec analysis ---------------- */

const SECRET_RES: { kind: string; re: RegExp }[] = [
  { kind: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "github_token", re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { kind: "github_pat", re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { kind: "stripe_key", re: /\b[rs]k_(live|test)_[A-Za-z0-9]{16,}\b/ },
  { kind: "openai_key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { kind: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const SENSITIVE_PATH = /\/(admin|debug|actuator|graphql|console|wp-admin|\.env|\.git|phpinfo)/i;

interface SpecEndpoint {
  method: string;
  name: string;
  url: string;
  hasAuth: boolean;
}

function postmanUrl(u: unknown): string {
  if (typeof u === "string") return u;
  if (u && typeof u === "object") {
    const o = u as Record<string, unknown>;
    if (typeof o.raw === "string" && o.raw) return o.raw;
  }
  return "";
}

function collectSpecEndpoints(spec: unknown): SpecEndpoint[] {
  const out: SpecEndpoint[] = [];
  if (!spec || typeof spec !== "object") return out;
  const s = spec as Record<string, unknown>;

  if (Array.isArray(s.item)) {
    // Postman collection
    const collAuth = (s.auth as Record<string, unknown> | undefined)?.type;
    const walk = (items: unknown[]): void => {
      for (const raw of items) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        if (Array.isArray(item.item)) {
          walk(item.item as unknown[]);
          continue;
        }
        const req = item.request;
        if (!req || typeof req !== "object") continue;
        const r = req as Record<string, unknown>;
        const headers = Array.isArray(r.header) ? r.header : [];
        const hasAuthHeader = headers.some(
          (h) =>
            h &&
            typeof h === "object" &&
            /^(authorization|x-api-key)$/i.test(String((h as Record<string, unknown>).key ?? "")),
        );
        const reqAuth = (r.auth as Record<string, unknown> | undefined)?.type;
        out.push({
          method: typeof r.method === "string" ? r.method.toUpperCase() : "GET",
          name: typeof item.name === "string" ? item.name : "unnamed",
          url: postmanUrl(r.url),
          hasAuth:
            Boolean(reqAuth && reqAuth !== "noauth") ||
            Boolean(collAuth && collAuth !== "noauth") ||
            hasAuthHeader,
        });
      }
    };
    walk(s.item as unknown[]);
  } else if (s.openapi && typeof s.paths === "object" && s.paths) {
    // OpenAPI
    const paths = s.paths as Record<string, Record<string, unknown>>;
    const secured = Boolean((s.components as Record<string, unknown> | undefined)?.securitySchemes);
    for (const [p, ops] of Object.entries(paths)) {
      if (!ops || typeof ops !== "object") continue;
      for (const [m, op] of Object.entries(ops)) {
        if (!/^(get|post|put|patch|delete|head|options)$/i.test(m)) continue;
        const o = (op ?? {}) as Record<string, unknown>;
        out.push({
          method: m.toUpperCase(),
          name: typeof o.operationId === "string" ? o.operationId : p,
          url: p,
          hasAuth: secured || Boolean(o.security),
        });
      }
    }
  }
  return out;
}

function analyzeSpec(spec: unknown, findings: Finding[]): { credentialHits: number } {
  const endpoints = collectSpecEndpoints(spec);
  let credentialHits = 0;

  if (endpoints.length === 0) {
    findings.push({
      title: "No endpoints found — not a recognizable Postman or OpenAPI document.",
      severity: "info",
      category: "spec",
    });
    return { credentialHits };
  }

  for (const e of endpoints.slice(0, 200)) {
    if (/^http:\/\//i.test(e.url)) {
      findings.push({
        title: `Cleartext http:// endpoint — traffic and credentials travel unencrypted.`,
        severity: "high",
        category: "transport",
        endpoint: e.url,
        method: e.method,
      });
    }
    if (!e.hasAuth) {
      findings.push({
        title: `Endpoint has no auth configured: ${e.name}.`,
        severity: "medium",
        category: "auth",
        endpoint: e.url || undefined,
        method: e.method,
      });
    }
    if (SENSITIVE_PATH.test(e.url)) {
      findings.push({
        title: `Sensitive-looking path exposed: ${e.url}.`,
        severity: "medium",
        category: "exposure",
        endpoint: e.url,
        method: e.method,
      });
    }
    if (/[?&](api[_-]?key|token|secret)=/i.test(e.url)) {
      findings.push({
        title: "Credential passed as a URL query parameter — ends up in logs and history.",
        severity: "medium",
        category: "secrets",
        endpoint: e.url,
        method: e.method,
      });
      credentialHits += 1;
    }
  }

  // Hardcoded secrets: scan the raw document text, report kinds only.
  let text = "";
  try {
    text = JSON.stringify(spec).slice(0, 2_000_000);
  } catch {
    text = "";
  }
  const seenKinds = new Set<string>();
  for (const p of SECRET_RES) {
    if (p.re.test(text) && !seenKinds.has(p.kind)) {
      seenKinds.add(p.kind);
      credentialHits += 1;
      findings.push({
        title: `Hardcoded secret detected in the spec (${p.kind}) — rotate it and move it to a vault.`,
        severity: "high",
        category: "secrets",
      });
    }
  }

  return { credentialHits };
}

/* ---------------- handler ---------------- */

export async function POST(request: Request) {
  if (scanRateLimited(clientIp(request))) {
    return NextResponse.json({ error: "Rate limited — try again shortly." }, { status: 429 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large (1 MB max)." }, { status: 413 });
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

  const { url, spec } = body as { url?: unknown; spec?: unknown };
  const findings: Finding[] = [];
  let credentialHits = 0;
  let scannedTarget = "";

  if (typeof url === "string" && url.trim()) {
    scannedTarget = url.trim();
    const validated = validateTargetUrl(scannedTarget);
    if (validated.ok === false) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const targetUrl = validated.url;

    let res: Response;
    try {
      res = await fetchGuarded(targetUrl);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? `Fetch failed: ${err.message}` : "Fetch failed." },
        { status: 502 },
      );
    }
    try {
      checkHeaders(res.headers, targetUrl.protocol === "https:", findings);
      findings.unshift({
        title: `Fetched ${targetUrl.hostname} — HTTP ${res.status}.`,
        severity: "info",
        category: "fetch",
        endpoint: targetUrl.toString(),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const text = await res
          .text()
          .then((t) => t.slice(0, 2_000_000))
          .catch(() => "");
        if (text) {
          try {
            const doc = JSON.parse(text) as unknown;
            const r = analyzeSpec(doc, findings);
            credentialHits += r.credentialHits;
            findings.push({
              title: "Response body looks like an API spec — static analysis included below.",
              severity: "info",
              category: "spec",
            });
          } catch {
            /* not a spec — header checks stand alone */
          }
        }
      }
      await res.body?.cancel();
    } catch (err) {
      await res.body?.cancel().catch(() => undefined);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Scan failed." },
        { status: 502 },
      );
    }
  } else if (spec !== undefined) {
    scannedTarget = "pasted spec";
    const r = analyzeSpec(spec, findings);
    credentialHits += r.credentialHits;
  } else {
    return NextResponse.json(
      { error: "Provide either a spec JSON document or a URL to scan." },
      { status: 400 },
    );
  }

  const ordered = findings.slice(0, MAX_FINDINGS);
  const riskScore = Math.min(
    100,
    findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0),
  );
  const riskLevel =
    riskScore >= 60
      ? "critical"
      : riskScore >= 35
        ? "high"
        : riskScore >= 15
          ? "medium"
          : riskScore > 0
            ? "low"
            : "none";

  return NextResponse.json({
    riskScore,
    riskLevel,
    totalFindings: findings.length,
    exposedCredentials: credentialHits,
    findings: ordered,
    truncated: findings.length > MAX_FINDINGS,
    message:
      findings.length === 0
        ? `Scanned ${scannedTarget} — no issues found in this preview.`
        : `Scanned ${scannedTarget} — ${findings.length} finding${findings.length === 1 ? "" : "s"} in this free preview.`,
  });
}
