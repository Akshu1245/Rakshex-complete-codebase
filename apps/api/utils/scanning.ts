import { nanoid } from "nanoid";
import {
  runScan,
  toLegacyFindings,
  calculateRiskScore as coreCalculateRiskScore,
  getRiskLevel as coreGetRiskLevel,
  safeGetPath as coreSafeGetPath,
} from "@rakshex/scanner-core";

// ── Collection Data Types ──────────────────────────────────────────────────

interface PostmanHeader {
  key?: string;
  value?: string;
}

interface PostmanRequest {
  method?: string;
  url?: string | { raw?: string };
  header?: PostmanHeader[];
}

interface PostmanItem {
  request?: PostmanRequest;
  name?: string;
}

interface OpenApiOperation {
  security?: Array<Record<string, string[]>>;
  parameters?: unknown[];
  responses?: Record<string, unknown>;
}

type OpenApiPaths = Record<string, Record<string, OpenApiOperation>>;

export interface CollectionData {
  item?: PostmanItem[];
  paths?: OpenApiPaths;
  security?: Array<Record<string, string[]>>;
}

interface ScannedEndpoint {
  url: string;
  method: string;
  headers: PostmanHeader[];
  hasSecurity?: boolean;
}

// ── Finding Types ──────────────────────────────────────────────────────────

type Severity = "Critical" | "High" | "Medium" | "Low";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Finding {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  category: string;
  remediation: string;
  cweId: string;
  ruleId?: string;
  confidence?: string;
  fingerprint?: string;
  endpoint?: string;
  method?: string;
  evidence?: unknown;
}

export interface ShadowAPI {
  endpoint: string;
  method: string;
  riskLevel: RiskLevel;
  reason: string;
  recommendation: string;
}

interface PCIRequirement {
  id: string;
  title: string;
  description: string;
  status: "met" | "not_met" | "manual_review";
}

interface OWASPRequirement {
  id: string;
  title: string;
  description: string;
  status: "met" | "not_met" | "manual_review";
}

function extractUrl(req: PostmanRequest | undefined): string {
  if (!req?.url) return "";
  if (typeof req.url === "string") return req.url;
  return req.url.raw || "";
}

/**
 * Path helper kept for callers (prompt injection scan, etc.).
 * Returns null when the URL cannot be parsed (legacy contract).
 */
export function safeGetPath(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const path = coreSafeGetPath(rawUrl);
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Deterministic API security findings via @rakshex/scanner-core.
 * Keeps the legacy Finding shape expected by scanService / DB writers.
 */
export function generateRealFindings(collectionData: CollectionData): Finding[] {
  const result = runScan(collectionData);
  // Preserve rich scanner fields for persistence (ruleId, confidence, evidence, etc.)
  return result.findings.map((f) => {
    const cwe = f.standards.cwe?.[0] ?? "CWE-0";
    const owasp = f.standards.owaspApi?.[0] ?? f.standards.owaspLlm?.[0];
    return {
      id: nanoid(),
      title: f.title,
      severity: f.severity,
      description: f.description,
      category: owasp ? `${f.category} (${owasp})` : f.category,
      remediation: f.remediation,
      cweId: cwe,
      ruleId: f.ruleId,
      confidence: f.confidence,
      fingerprint: f.fingerprint,
      endpoint: f.endpoint,
      method: f.method,
      evidence: f.evidence,
    };
  });
}

export function detectShadowAPIs(collectionData: CollectionData): ShadowAPI[] {
  const shadowAPIs: ShadowAPI[] = [];

  const items = collectionData.item || [];
  const riskyKeywords = [
    "debug",
    "test",
    "internal",
    "admin",
    "hidden",
    "dev",
    "beta",
    "staging",
    "old",
    "backup",
    "temp",
    "tmp",
    "legacy",
  ];
  const safePrefixes = ["/api/v1", "/api/v2", "/api/v3", "/public", "/v1", "/v2", "/v3"];
  const seen = new Set<string>();

  // Normalize endpoints from both Postman collections (item[]) and OpenAPI
  // specs (paths{}) so shadow discovery covers either import format.
  const endpoints: Array<{ method: string; path: string }> = [];
  items.forEach((item: PostmanItem) => {
    endpoints.push({
      method: (item.request?.method || "GET").toUpperCase(),
      path: safeGetPath(extractUrl(item.request)) || "/",
    });
  });
  const openApiPaths = collectionData.paths || {};
  for (const [rawPath, methods] of Object.entries(openApiPaths)) {
    const methodMap = (methods || {}) as Record<string, unknown>;
    for (const m of Object.keys(methodMap)) {
      if (["get", "post", "put", "delete", "patch"].includes(m.toLowerCase())) {
        endpoints.push({ method: m.toUpperCase(), path: rawPath || "/" });
      }
    }
  }

  endpoints.forEach(({ method, path }) => {
    const key = method + ":" + path;
    if (seen.has(key)) return;
    seen.add(key);

    const lowerPath = path.toLowerCase();
    const matchedKeyword = riskyKeywords.find((k) => lowerPath.includes(k));
    const isUnusualPath = !safePrefixes.some((prefix) => lowerPath.startsWith(prefix));
    const isDestructiveWithoutPrefix =
      (method === "DELETE" || method === "PUT") &&
      !safePrefixes.some((p) => lowerPath.startsWith(p));
    const isUndocumentedAdminOp =
      (lowerPath.includes("admin") || lowerPath.includes("internal")) &&
      ["DELETE", "PUT", "POST"].includes(method);

    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    let reason = "";
    let recommendation = "";

    if (isUndocumentedAdminOp) {
      riskLevel = "CRITICAL";
      reason = "Admin/internal endpoint detected with destructive " + method + " operation";
      recommendation =
        "Document all admin endpoints in your API spec and restrict access via authentication/authorization.";
    } else if (isDestructiveWithoutPrefix) {
      riskLevel = "HIGH";
      reason = "Destructive " + method + " endpoint without standard API versioning prefix";
      recommendation = "Add API versioning prefix (/api/v1) and document this endpoint.";
    } else if (matchedKeyword) {
      riskLevel = "MEDIUM";
      reason = "Endpoint path contains risky keyword: " + matchedKeyword;
      recommendation =
        "Review if " + matchedKeyword + " endpoint should be publicly accessible or documented.";
    } else if (isUnusualPath) {
      riskLevel = "LOW";
      reason = "Endpoint uses non-standard path pattern";
      recommendation = "Consider using standard REST conventions with API versioning.";
    }

    if (matchedKeyword || isUnusualPath || isDestructiveWithoutPrefix || isUndocumentedAdminOp) {
      shadowAPIs.push({
        endpoint: path,
        method,
        riskLevel,
        reason,
        recommendation,
      });
    }
  });

  return shadowAPIs;
}

export function calculateRiskScore(findings: Finding[]): number {
  return coreCalculateRiskScore(findings);
}

export function getRiskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  return coreGetRiskLevel(score);
}

export function generatePCIDSSRequirements(collectionData: CollectionData): PCIRequirement[] {
  const items = collectionData.item || [];
  const paths = collectionData.paths || {};
  const allItems: ScannedEndpoint[] = [
    ...items.map((i: PostmanItem) => ({
      url: typeof i.request?.url === "string" ? i.request.url : i.request?.url?.raw || "",
      method: (i.request?.method || "GET").toUpperCase(),
      headers: i.request?.header || [],
    })),
    ...Object.entries(paths).flatMap(([path, methods]) => {
      const methodMap = methods as Record<string, OpenApiOperation>;
      return Object.entries(methodMap)
        .filter(([m]) => ["get", "post", "put", "delete", "patch"].includes(m))
        .map(([method, op]) => ({
          url: path,
          method: method.toUpperCase(),
          headers: [],
          hasSecurity: !!(op?.security?.length || collectionData.security?.length),
        }));
    }),
  ];

  const requirements: PCIRequirement[] = [];

  // Req 4.2.1 — Strong cryptography during transmission over open networks.
  const hasHttp = allItems.some((i: ScannedEndpoint) => i.url.startsWith("http://"));
  requirements.push({
    id: "PCI-4.2.1",
    title: "Strong cryptography for data in transit",
    description:
      "PCI DSS v4.0.1 Req 4.2.1: PAN must be protected with strong cryptography (TLS) during transmission over open, public networks. All endpoints must use HTTPS.",
    status: hasHttp ? "not_met" : "met",
  });

  // Req 8.3.1 — Strong authentication for access to system components.
  const writeOpsWithoutAuth = allItems.filter(
    (i: ScannedEndpoint) =>
      ["POST", "PUT", "DELETE", "PATCH"].includes(i.method) &&
      !i.headers.some(
        (h: PostmanHeader) =>
          h.key?.toLowerCase().includes("authorization") ||
          h.key?.toLowerCase().includes("api-key"),
      ),
  );
  requirements.push({
    id: "PCI-8.3.1",
    title: "Authentication for access to system components",
    description:
      "PCI DSS v4.0.1 Req 8.3.1: all access to system components must be authenticated. Mutating (POST/PUT/DELETE/PATCH) endpoints must require an authorization or API-key header.",
    status: writeOpsWithoutAuth.length > 0 ? "not_met" : "met",
  });

  // Req 6.4.1 — Public-facing web apps hardened; test/debug interfaces removed.
  const hasDebug = allItems.some((i: ScannedEndpoint) => {
    const url = i.url.toLowerCase();
    return url.includes("debug") || url.includes("test") || url.includes("internal");
  });
  requirements.push({
    id: "PCI-6.4.1",
    title: "No debug/test/internal interfaces exposed",
    description:
      "PCI DSS v4.0.1 Req 6.4.1 / 6.5.5: debug, test, and internal endpoints (and test data) must not be reachable in the production attack surface.",
    status: hasDebug ? "not_met" : "met",
  });

  // Req 6.2.4 — Software engineering techniques to prevent common attacks (injection).
  const hasQueryParams = allItems.some((i: ScannedEndpoint) => {
    const url = i.url;
    return url.includes("?") || url.includes("{");
  });
  requirements.push({
    id: "PCI-6.2.4",
    title: "Input validation against injection attacks",
    description:
      "PCI DSS v4.0.1 Req 6.2.4: software engineering techniques must prevent injection attacks. Endpoints accepting parameters require validated/parameterised input (manual verification recommended).",
    status: hasQueryParams ? "manual_review" : "met",
  });

  // Req 10.2.1 — Audit logs to reconstruct access to system components.
  requirements.push({
    id: "PCI-10.2.1",
    title: "Audit logging of access events",
    description:
      "PCI DSS v4.0.1 Req 10.2.1: audit logs must capture access to system components and cardholder data. Verify server-side logging is enabled and retained.",
    status: "manual_review",
  });

  // Req 11.3.1 — Continuous/periodic vulnerability scanning of the API surface.
  requirements.push({
    id: "PCI-11.3.1",
    title: "Continuous API vulnerability scanning",
    description:
      "PCI DSS v4.0.1 Req 11.3.1: internal vulnerability scans must be performed regularly. Rakshex provides continuous automated API security scanning of this collection, satisfying the evidence requirement.",
    status: "met",
  });

  return requirements;
}

/**
 * GDPR technical-measures mapping (Art. 5, 25, 30, 32). Evidence-based from
 * the imported API surface — not a legal certification.
 */
export function generateGDPRRequirements(collectionData: CollectionData): OWASPRequirement[] {
  const items = collectionData.item || [];
  const paths = collectionData.paths || {};
  const allItems: ScannedEndpoint[] = [
    ...items.map((i: PostmanItem) => ({
      url: typeof i.request?.url === "string" ? i.request.url : i.request?.url?.raw || "",
      method: (i.request?.method || "GET").toUpperCase(),
      headers: i.request?.header || [],
    })),
    ...Object.entries(paths).flatMap(([path, methods]) => {
      const methodMap = methods as Record<string, OpenApiOperation>;
      return Object.entries(methodMap)
        .filter(([m]) => ["get", "post", "put", "delete", "patch"].includes(m))
        .map(([method]) => ({
          url: path,
          method: method.toUpperCase(),
          headers: [] as PostmanHeader[],
        }));
    }),
  ];

  const hasHttp = allItems.some((i: ScannedEndpoint) => i.url.startsWith("http://"));
  const writeOpsWithoutAuth = allItems.some(
    (i: ScannedEndpoint) =>
      ["POST", "PUT", "DELETE", "PATCH"].includes(i.method) &&
      !i.headers.some(
        (h: PostmanHeader) =>
          h.key?.toLowerCase().includes("authorization") ||
          h.key?.toLowerCase().includes("api-key"),
      ),
  );
  const hasDebug = allItems.some((i: ScannedEndpoint) => {
    const url = i.url.toLowerCase();
    return url.includes("debug") || url.includes("test") || url.includes("internal");
  });

  return [
    {
      id: "GDPR-Art.32(1)(a)",
      title: "Encryption of personal data in transit",
      description:
        "Art. 32(1)(a): appropriate technical measures including encryption. All endpoints transmitting personal data must use TLS/HTTPS.",
      status: hasHttp ? "not_met" : "met",
    },
    {
      id: "GDPR-Art.32(1)(b)",
      title: "Confidentiality via access control",
      description:
        "Art. 32(1)(b): ensure ongoing confidentiality of processing systems. Endpoints that create/modify/delete personal data must enforce authentication.",
      status: writeOpsWithoutAuth ? "not_met" : "met",
    },
    {
      id: "GDPR-Art.5(1)(f)",
      title: "Integrity and confidentiality (no exposed internal surfaces)",
      description:
        "Art. 5(1)(f): personal data processed securely. Debug/test/internal endpoints must not be exposed in production.",
      status: hasDebug ? "not_met" : "met",
    },
    {
      id: "GDPR-Art.25",
      title: "Data protection by design and by default",
      description:
        "Art. 25: input validation and data minimisation should be enforced for endpoints accepting user-supplied parameters (manual verification recommended).",
      status: "manual_review",
    },
    {
      id: "GDPR-Art.30",
      title: "Records of processing / audit logging",
      description:
        "Art. 30: maintain records of processing activities. Verify server-side audit logging of access to personal data is enabled and retained.",
      status: "manual_review",
    },
  ];
}

export function generateOWASPRequirements(collectionData: CollectionData): OWASPRequirement[] {
  const items = collectionData.item || [];
  const paths = collectionData.paths || {};
  const allItems: ScannedEndpoint[] = [
    ...items.map((i: PostmanItem) => ({
      url: typeof i.request?.url === "string" ? i.request.url : i.request?.url?.raw || "",
      method: (i.request?.method || "GET").toUpperCase(),
      headers: i.request?.header || [],
    })),
    ...Object.entries(paths).flatMap(([path, methods]) => {
      const methodMap = methods as Record<string, OpenApiOperation>;
      return Object.entries(methodMap)
        .filter(([m]) => ["get", "post", "put", "delete", "patch"].includes(m))
        .map(([method]) => ({
          url: path,
          method: method.toUpperCase(),
          headers: [] as PostmanHeader[],
        }));
    }),
  ];

  return [
    {
      id: "OWASP-A01",
      title: "Broken Access Control",
      description: "Access control checks should be enforced server-side for every request.",
      status: allItems.some((i: ScannedEndpoint) => /\/\d+/.test(i.url)) ? "manual_review" : "met",
    },
    {
      id: "OWASP-A02",
      title: "Cryptographic Failures",
      description: "All data transmission should use strong encryption (TLS 1.2+).",
      status: allItems.some((i: ScannedEndpoint) => i.url.startsWith("http://"))
        ? "not_met"
        : "met",
    },
    {
      id: "OWASP-A03",
      title: "Injection",
      description: "User-supplied data should be validated, sanitized, and escaped.",
      status: "manual_review",
    },
    {
      id: "OWASP-A04",
      title: "Insecure Design",
      description: "Security should be integrated into the design phase.",
      status: "manual_review",
    },
    {
      id: "OWASP-A05",
      title: "Security Misconfiguration",
      description: "Systems should be hardened with minimal features and secure defaults.",
      status: allItems.some((i: ScannedEndpoint) => i.url.toLowerCase().includes("debug"))
        ? "not_met"
        : "met",
    },
    {
      id: "OWASP-A06",
      title: "Vulnerable and Outdated Components",
      description: "Components should be kept up to date with known vulnerabilities patched.",
      status: "manual_review",
    },
    {
      id: "OWASP-A07",
      title: "Identification and Authentication Failures",
      description: "Authentication should be implemented correctly using secure mechanisms.",
      status: allItems.some(
        (i: ScannedEndpoint) =>
          ["POST", "PUT", "DELETE"].includes(i.method) &&
          !i.headers.some((h: PostmanHeader) => h.key?.toLowerCase().includes("authorization")),
      )
        ? "not_met"
        : "met",
    },
    {
      id: "OWASP-A08",
      title: "Software and Data Integrity Failures",
      description: "Software updates and critical data should be verified for integrity.",
      status: "manual_review",
    },
    {
      id: "OWASP-A09",
      title: "Security Logging and Monitoring Failures",
      description: "Security events should be logged and monitored.",
      status: "manual_review",
    },
    {
      id: "OWASP-A10",
      title: "Server-Side Request Forgery (SSRF)",
      description: "Server-side requests should be validated and restricted.",
      status: "manual_review",
    },
  ];
}
