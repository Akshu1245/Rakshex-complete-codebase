import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

export const missingCorrelationRule: ScanRule = {
  id: "api.missing_correlation_id",
  name: "Missing Request Correlation ID",
  category: "logging",
  description: "Non-GET requests without correlation/request ID headers.",
  severity: "Low",
  confidence: "informational",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-778"],
  },
  evaluate(collection) {
    return collection.endpoints
      .filter((ep) => {
        if (ep.method === "GET" || ep.source === "openapi") return false;
        return !ep.headers.some((h) => {
          const k = h.key.toLowerCase();
          return (
            k.includes("x-request-id") || k.includes("x-correlation-id") || k.includes("request-id")
          );
        });
      })
      .map((ep) => ({
        ruleId: "api.missing_correlation_id",
        title: "Missing Request Correlation ID",
        description: `${ep.method} ${ep.url || ep.path} does not include a correlation/request ID header, making the audit trail incomplete.`,
        severity: "Low" as const,
        confidence: "informational" as const,
        category: "logging" as const,
        remediation: "Include X-Request-ID or X-Correlation-ID headers for all non-GET requests.",
        evidence: [
          {
            summary: "No correlation header on mutating/non-GET request",
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-778"] },
        fingerprint: fingerprint("api.missing_correlation_id", ep.method, ep.path),
      }));
  },
};
