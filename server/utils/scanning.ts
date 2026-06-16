import { nanoid } from "nanoid";

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
}

interface ShadowAPI {
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

export function safeGetPath(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const fullUrl = rawUrl.startsWith("http")
      ? rawUrl
      : "https://example.com" + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl);
    return new URL(fullUrl).pathname;
  } catch {
    return null;
  }
}

export function generateRealFindings(collectionData: CollectionData): Finding[] {
  const findings: Finding[] = [];

  const items = collectionData.item || [];
  const openApiPaths = collectionData.paths || {};

  // Process Postman-style items
  items.forEach((item: PostmanItem) => {
    const displayUrl = extractUrl(item.request);
    const headers: PostmanHeader[] = item.request?.header || [];
    const method: string = (item.request?.method || "").toUpperCase();
    if (displayUrl.startsWith("http://")) {
      findings.push({
        id: nanoid(),
        title: "Cleartext HTTP Communication",
        severity: "High",
        description: "Endpoint " + displayUrl + " transmits data over unencrypted HTTP.",
        category: "Cryptographic Failures (OWASP A02)",
        remediation:
          "Enforce HTTPS on all endpoints. Set up HTTP → HTTPS redirect on your server or load balancer.",
        cweId: "CWE-319",
      });
    }

    // OWASP A07 - Authentication: mutating endpoint without auth header
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const hasAuth = headers.some(
        (h: PostmanHeader) =>
          typeof h.key === "string" &&
          (h.key.toLowerCase().includes("authorization") ||
            h.key.toLowerCase().includes("x-api-key") ||
            h.key.toLowerCase().includes("api-key")),
      );
      if (!hasAuth) {
        findings.push({
          id: nanoid(),
          title: "Unauthenticated State-Changing Request",
          severity: "Critical",
          description:
            method +
            " " +
            (displayUrl || "endpoint") +
            " has no Authorization or API-Key header, making it vulnerable to unauthorized writes.",
          category: "Broken Authentication (OWASP A07)",
          remediation:
            "Add an Authorization: Bearer <token> or X-API-Key header. Validate server-side on every request.",
          cweId: "CWE-306",
        });
      }
    }

    // OWASP A01 - Broken Access Control: integer IDs in URL path (IDOR risk)
    const path = safeGetPath(displayUrl);
    if (path && /\/\d+/.test(path)) {
      findings.push({
        id: nanoid(),
        title: "Potential Insecure Direct Object Reference (IDOR)",
        severity: "Medium",
        description:
          "Endpoint " +
          path +
          " uses a sequential integer ID, which could allow unauthorized access to other users' resources.",
        category: "Broken Access Control (OWASP A01)",
        remediation:
          "Replace integer IDs with UUIDs. Always verify the authenticated user owns the resource before returning data.",
        cweId: "CWE-639",
      });
    }

    // OWASP A05 - Security Misconfiguration: debug or test headers present
    const hasDebugHeader = headers.some(
      (h: PostmanHeader) =>
        typeof h.key === "string" &&
        (h.key.toLowerCase().startsWith("x-debug") || h.key.toLowerCase() === "x-forwarded-for"),
    );
    if (hasDebugHeader) {
      findings.push({
        id: nanoid(),
        title: "Debug Headers Exposed in Request",
        severity: "Low",
        description:
          "Request to " +
          (displayUrl || "endpoint") +
          " includes debug headers that should never appear in production traffic.",
        category: "Security Misconfiguration (OWASP A05)",
        remediation:
          "Remove debug headers (X-Debug-*, X-Forwarded-For) before deploying to production.",
        cweId: "CWE-489",
      });
    }

    // OWASP A09 - Security Logging: missing request ID / correlation ID header
    if (method !== "GET") {
      const hasCorrelation = headers.some(
        (h: PostmanHeader) =>
          typeof h.key === "string" &&
          (h.key.toLowerCase().includes("x-request-id") ||
            h.key.toLowerCase().includes("x-correlation-id") ||
            h.key.toLowerCase().includes("request-id")),
      );
      if (!hasCorrelation) {
        findings.push({
          id: nanoid(),
          title: "Missing Request Correlation ID",
          severity: "Low",
          description:
            method +
            " " +
            (displayUrl || "endpoint") +
            " does not include a correlation/request ID header, making audit trail incomplete.",
          category: "Security Logging Failures (OWASP A09)",
          remediation:
            "Include X-Request-ID or X-Correlation-ID headers for all non-GET requests to ensure full request traceability.",
          cweId: "CWE-778",
        });
      }
    }
  });

  // Process OpenAPI paths for additional checks
  Object.entries(openApiPaths).forEach(([pathStr, pathItem]) => {
    const methods = pathItem as Record<string, OpenApiOperation>;
    Object.entries(methods).forEach(([httpMethod, operation]) => {
      if (["get", "post", "put", "delete", "patch"].includes(httpMethod)) {
        const hasSecurity =
          (operation.security && operation.security.length > 0) ||
          (collectionData.security && collectionData.security.length > 0);
        if (!hasSecurity && httpMethod !== "get") {
          findings.push({
            id: nanoid(),
            title: "OpenAPI Endpoint Missing Security Scheme",
            severity: "High",
            description:
              httpMethod.toUpperCase() +
              " " +
              pathStr +
              " has no security scheme defined in the OpenAPI spec.",
            category: "Broken Authentication (OWASP A07)",
            remediation:
              "Add a security: [] block to this operation referencing your securitySchemes (e.g. bearerAuth).",
            cweId: "CWE-306",
          });
        }
      }
    });
  });

  return findings;
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

  items.forEach((item: PostmanItem) => {
    const method = (item.request?.method || "GET").toUpperCase();
    const displayUrl = extractUrl(item.request);
    const path = safeGetPath(displayUrl) || "/";

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
  let score = 0;
  for (const finding of findings) {
    if (finding.severity === "Critical") score += 30;
    else if (finding.severity === "High") score += 20;
    else if (finding.severity === "Medium") score += 10;
    else if (finding.severity === "Low") score += 5;
  }
  return Math.min(100, score);
}

export function getRiskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
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

  // Req 1: TLS for all connections
  const hasHttp = allItems.some((i: ScannedEndpoint) => {
    const url = i.url;
    return url.startsWith("http://");
  });
  requirements.push({
    id: "PCI-1.1",
    title: "TLS for All Connections",
    description: "All API endpoints must use HTTPS/TLS for data transmission.",
    status: hasHttp ? "not_met" : "met",
  });

  // Req 2: Authentication for sensitive operations
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
    id: "PCI-2.1",
    title: "Authentication for Write Operations",
    description: "All POST/PUT/DELETE operations must require authentication.",
    status: writeOpsWithoutAuth.length > 0 ? "not_met" : "met",
  });

  // Req 3: No debug endpoints in production
  const hasDebug = allItems.some((i: ScannedEndpoint) => {
    const url = i.url.toLowerCase();
    return url.includes("debug") || url.includes("test") || url.includes("internal");
  });
  requirements.push({
    id: "PCI-3.1",
    title: "No Debug/Test Endpoints",
    description: "Debug, test, and internal endpoints must not be exposed in production.",
    status: hasDebug ? "not_met" : "met",
  });

  // Req 4: Input validation
  const hasQueryParams = allItems.some((i: ScannedEndpoint) => {
    const url = i.url;
    return url.includes("?") || url.includes("{");
  });
  requirements.push({
    id: "PCI-4.1",
    title: "Input Validation",
    description: "All user input must be validated before processing.",
    status: hasQueryParams ? "manual_review" : "met",
  });

  // Req 5: Audit logging
  requirements.push({
    id: "PCI-5.1",
    title: "Audit Logging",
    description: "All access to cardholder data must be logged.",
    status: "manual_review",
  });

  return requirements;
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
