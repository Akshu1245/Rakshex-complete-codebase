import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

export const debugHeadersRule: ScanRule = {
  id: "api.debug_headers",
  name: "Debug Headers Exposed in Request",
  category: "misconfiguration",
  description: "Detects debug-oriented headers that should not appear in production traffic.",
  severity: "Low",
  confidence: "potential",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-489"],
    owaspApi: ["API8:2023"],
  },
  evaluate(collection) {
    return collection.endpoints
      .filter((ep) =>
        ep.headers.some((h) => {
          const k = h.key.toLowerCase();
          return k.startsWith("x-debug") || k === "x-forwarded-for";
        }),
      )
      .map((ep) => ({
        ruleId: "api.debug_headers",
        title: "Debug Headers Exposed in Request",
        description: `Request to ${ep.url || ep.path} includes debug headers that should never appear in production traffic.`,
        severity: "Low" as const,
        confidence: "potential" as const,
        category: "misconfiguration" as const,
        remediation:
          "Remove debug headers (X-Debug-*, client-supplied X-Forwarded-For) before production.",
        evidence: [
          {
            summary: "Debug or spoofable forwarding headers present",
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-489"] },
        fingerprint: fingerprint("api.debug_headers", ep.method, ep.path),
      }));
  },
};
