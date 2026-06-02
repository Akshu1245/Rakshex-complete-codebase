/**
 * Demo scanner — pure, dependency-free static analysis of a Postman / OpenAPI
 * style collection. Powers the public no-login demo endpoint (POST via
 * `demo.scan`). Mirrors the heuristics the marketing demo page uses so results
 * are consistent, but runs server-side so we can rate-limit and trust it.
 */

export type DemoSeverity = "Critical" | "High" | "Medium" | "Low";

export interface DemoFinding {
  id: string;
  severity: DemoSeverity;
  title: string;
  endpoint: string;
  category: string;
  remediation: string;
}

export interface DemoCredentialLeak {
  type: string;
  location: string;
  keyPreview: string;
  severity: string;
}

export interface DemoScanResult {
  findings: DemoFinding[];
  credentials: DemoCredentialLeak[];
  endpoints: string[];
  riskScore: number;
  owaspScore: number;
  pciScore: number;
  scanTime: number;
}

const SECRET_PATTERNS: Array<{ regex: RegExp; type: string }> = [
  { regex: /sk-[a-zA-Z0-9]{48}/g, type: "OpenAI API Key" },
  { regex: /sk-ant-[a-zA-Z0-9]{32,}/g, type: "Anthropic API Key" },
  { regex: /AIza[0-9A-Za-z_-]{35}/g, type: "Google AI API Key" },
  { regex: /Bearer\s+[a-zA-Z0-9._-]{20,}/g, type: "Bearer Token" },
  { regex: /Basic\s+[A-Za-z0-9+/=]{20,}/g, type: "Basic Auth Token" },
  { regex: /password\s*[:=]\s*["'][^"']{4,}["']/gi, type: "Hardcoded Password" },
  { regex: /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi, type: "Hardcoded API Key" },
];

const SEVERITY_WEIGHTS: Record<DemoSeverity, number> = {
  Critical: 10,
  High: 7,
  Medium: 4,
  Low: 1,
};

// Minimal structural typing for the parts of a Postman collection we read.
interface RequestLike {
  url?: string | { raw?: string; host?: string[] };
  method?: string;
  header?: Array<{ key?: string }>;
  body?: unknown;
}
interface ItemLike {
  name?: string;
  request?: RequestLike;
  item?: ItemLike[];
}
interface CollectionLike {
  item?: ItemLike[];
}

function resolveUrl(url: RequestLike["url"]): string {
  if (typeof url === "string") return url;
  if (url?.raw) return url.raw;
  if (url?.host) return url.host.join(".");
  return "unknown";
}

export function performDemoScan(collection: CollectionLike): DemoScanResult {
  const startTime = Date.now();
  const findings: DemoFinding[] = [];
  const credentials: DemoCredentialLeak[] = [];
  const endpoints: string[] = [];

  const walkItems = (items: ItemLike[] | undefined, path = ""): void => {
    items?.forEach((item, idx) => {
      const currentPath = path
        ? `${path} > ${item.name || `Item ${idx}`}`
        : item.name || `Item ${idx}`;

      if (item.request) {
        const req = item.request;
        const url = resolveUrl(req.url);
        const method = req.method || "GET";
        const endpointId = `${method} ${url}`;
        endpoints.push(endpointId);

        if (url.startsWith("http://")) {
          findings.push({
            id: `find-${findings.length}`,
            severity: "High",
            title: "Insecure HTTP endpoint detected",
            endpoint: endpointId,
            category: "OWASP API2:2023 — Broken Authentication",
            remediation: "Change URL to use HTTPS protocol",
          });
        }

        const headers = req.header || [];
        const headerNames = headers.map((h) => (h.key || "").toLowerCase());

        if (!headerNames.includes("authorization") && !headerNames.includes("x-api-key")) {
          findings.push({
            id: `find-${findings.length}`,
            severity: "Medium",
            title: "Missing authentication header",
            endpoint: endpointId,
            category: "OWASP API2:2023 — Broken Authentication",
            remediation: "Add Authorization or X-API-Key header",
          });
        }

        const allText = JSON.stringify({ url, headers, body: req.body });
        for (const { regex, type } of SECRET_PATTERNS) {
          const matches = allText.match(regex);
          if (matches) {
            for (const match of matches) {
              const preview = match.substring(0, 12) + "..." + match.substring(match.length - 4);
              credentials.push({ type, location: currentPath, keyPreview: preview, severity: "Critical" });
              findings.push({
                id: `find-${findings.length}`,
                severity: "Critical",
                title: `Exposed ${type} in collection`,
                endpoint: endpointId,
                category: "OWASP API3:2023 — Broken Object Property Level Authorization",
                remediation: `Move ${type} to environment variables or secret manager`,
              });
            }
          }
        }

        if (
          /\{\{userId\}\}|\{userId\}|\/:userId|\/\d+/.test(url) &&
          !headerNames.includes("authorization")
        ) {
          findings.push({
            id: `find-${findings.length}`,
            severity: "Critical",
            title: "Potential BOLA vulnerability — user ID in URL without auth",
            endpoint: endpointId,
            category: "OWASP API1:2023 — Broken Object Level Authorization",
            remediation: "Add authorization checks for user-specific resources",
          });
        }
      }

      if (item.item) walkItems(item.item, currentPath);
    });
  };

  walkItems(collection.item || []);

  const uniqueFindings = findings.filter(
    (f, i, arr) => arr.findIndex((t) => t.title === f.title && t.endpoint === f.endpoint) === i,
  );
  const uniqueCredentials = credentials.filter(
    (c, i, arr) => arr.findIndex((t) => t.keyPreview === c.keyPreview) === i,
  );

  const rawRisk = uniqueFindings.reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 0), 0);
  const maxRisk = uniqueFindings.length * 10 || 1;
  const riskScore = Math.min(100, Math.round((rawRisk / maxRisk) * 100));

  const criticalCount = uniqueFindings.filter((f) => f.severity === "Critical").length;
  const highCount = uniqueFindings.filter((f) => f.severity === "High").length;
  const owaspScore = Math.max(0, Math.round(100 - (criticalCount * 15 + highCount * 8)));
  const pciScore = Math.max(0, Math.round(100 - (criticalCount * 20 + highCount * 10)));

  return {
    findings: uniqueFindings,
    credentials: uniqueCredentials,
    endpoints: [...new Set(endpoints)],
    riskScore,
    owaspScore,
    pciScore,
    scanTime: Math.max(1, Date.now() - startTime),
  };
}
