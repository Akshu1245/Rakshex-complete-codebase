import { fingerprint, hasAuthHeader } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

const MUTATING = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export const missingAuthRule: ScanRule = {
  id: "api.missing_authentication",
  name: "Unauthenticated State-Changing Request",
  category: "authentication",
  description:
    "Detects mutating endpoints without Authorization or API-key headers (Postman) or security schemes (OpenAPI).",
  severity: "Critical",
  confidence: "potential",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-306"],
    owaspApi: ["API2:2023"],
  },
  evaluate(collection) {
    const findings = [];

    for (const ep of collection.endpoints) {
      if (!MUTATING.has(ep.method)) continue;

      if (ep.source === "openapi") {
        if (ep.hasDeclaredSecurity) continue;
        findings.push({
          ruleId: "api.missing_authentication",
          title: "OpenAPI Endpoint Missing Security Scheme",
          description: `${ep.method} ${ep.path} has no security scheme defined in the OpenAPI spec.`,
          severity: "High" as const,
          confidence: "high" as const,
          category: "authentication" as const,
          remediation:
            "Add a security block to this operation referencing your securitySchemes (e.g. bearerAuth).",
          businessImpact: "Unauthenticated write access may allow data tampering.",
          evidence: [
            {
              summary: "No operation or global security scheme",
              location: `${ep.method} ${ep.path}`,
            },
          ],
          endpoint: ep.path,
          method: ep.method,
          standards: { cwe: ["CWE-306"], owaspApi: ["API2:2023"] },
          fingerprint: fingerprint("api.missing_authentication", ep.method, ep.path),
        });
        continue;
      }

      if (hasAuthHeader(ep.headers)) continue;

      findings.push({
        ruleId: "api.missing_authentication",
        title: "Unauthenticated State-Changing Request",
        description: `${ep.method} ${ep.url || ep.path} has no Authorization or API-Key header, making it vulnerable to unauthorized writes.`,
        severity: "Critical" as const,
        confidence: "potential" as const,
        category: "authentication" as const,
        remediation:
          "Add an Authorization: Bearer <token> or X-API-Key header. Validate server-side on every request.",
        businessImpact: "Attackers may create, modify, or delete resources without credentials.",
        evidence: [
          {
            summary: "No Authorization / API-Key header on mutating request",
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-306"], owaspApi: ["API2:2023"] },
        fingerprint: fingerprint("api.missing_authentication", ep.method, ep.path),
      });
    }

    return findings;
  },
};
