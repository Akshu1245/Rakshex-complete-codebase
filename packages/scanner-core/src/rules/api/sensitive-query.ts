import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "ssn",
  "credit_card",
  "card_number",
  "cvv",
  "authorization",
];

export const sensitiveQueryRule: ScanRule = {
  id: "api.sensitive_data_in_query",
  name: "Sensitive Data in Query Parameters",
  category: "data_exposure",
  description: "Detects query parameter names that suggest secrets or PII in URLs.",
  severity: "High",
  confidence: "high",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-598"],
    owaspApi: ["API3:2023"],
  },
  evaluate(collection) {
    const findings = [];
    for (const ep of collection.endpoints) {
      const hits = ep.queryKeys.filter((k) =>
        SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)),
      );
      if (hits.length === 0) continue;
      findings.push({
        ruleId: "api.sensitive_data_in_query",
        title: "Sensitive Data in Query Parameters",
        description: `${ep.method} ${ep.path} includes query parameters that appear sensitive: ${hits.join(", ")}. Query strings are logged by proxies and browsers.`,
        severity: "High" as const,
        confidence: "high" as const,
        category: "data_exposure" as const,
        remediation:
          "Move secrets and PII to headers or the request body over HTTPS. Never put credentials in the query string.",
        businessImpact: "Secrets leak via access logs, referrer headers, and browser history.",
        evidence: [
          {
            summary: `Sensitive query keys: ${hits.join(", ")}`,
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-598"], owaspApi: ["API3:2023"] },
        fingerprint: fingerprint("api.sensitive_data_in_query", ep.method, ep.path),
      });
    }
    return findings;
  },
};
