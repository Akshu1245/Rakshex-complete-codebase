import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

export const insecureHttpRule: ScanRule = {
  id: "api.insecure_http",
  name: "Cleartext HTTP Communication",
  category: "cryptography",
  description: "Detects endpoints that transmit data over unencrypted HTTP.",
  severity: "High",
  confidence: "high",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-319"],
    owaspApi: ["API8:2023"],
  },
  evaluate(collection) {
    return collection.endpoints
      .filter((ep) => ep.url.startsWith("http://"))
      .map((ep) => ({
        ruleId: "api.insecure_http",
        title: "Cleartext HTTP Communication",
        description: `Endpoint ${ep.url} transmits data over unencrypted HTTP.`,
        severity: "High" as const,
        confidence: "high" as const,
        category: "cryptography" as const,
        remediation:
          "Enforce HTTPS on all endpoints. Set up HTTP → HTTPS redirect on your server or load balancer.",
        businessImpact: "Credentials and PII can be intercepted on the network.",
        evidence: [
          {
            summary: "URL uses http:// scheme",
            location: `${ep.method} ${ep.path}`,
            snippet: ep.url,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-319"], owaspApi: ["API8:2023"] },
        fingerprint: fingerprint("api.insecure_http", ep.method, ep.path),
      }));
  },
};
