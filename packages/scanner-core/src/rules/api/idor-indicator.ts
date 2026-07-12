import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

export const idorIndicatorRule: ScanRule = {
  id: "api.idor_sequential_id",
  name: "Potential Insecure Direct Object Reference (IDOR)",
  category: "authorization",
  description: "Flags paths that use sequential integer IDs (enumeration / IDOR risk indicator).",
  severity: "Medium",
  confidence: "potential",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-639"],
    owaspApi: ["API1:2023"],
  },
  evaluate(collection) {
    return collection.endpoints
      .filter((ep) => /\/\d+(?:\/|$)/.test(ep.path))
      .map((ep) => ({
        ruleId: "api.idor_sequential_id",
        title: "Potential Insecure Direct Object Reference (IDOR)",
        description: `Endpoint ${ep.path} uses a sequential integer ID, which could allow unauthorized access to other users' resources.`,
        severity: "Medium" as const,
        confidence: "potential" as const,
        category: "authorization" as const,
        remediation:
          "Replace integer IDs with UUIDs. Always verify the authenticated user owns the resource before returning data.",
        businessImpact: "Horizontal privilege escalation across user-owned resources.",
        evidence: [
          {
            summary: "Path contains sequential numeric identifier",
            location: `${ep.method} ${ep.path}`,
            snippet: ep.path,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-639"], owaspApi: ["API1:2023"] },
        fingerprint: fingerprint("api.idor_sequential_id", ep.method, ep.path),
      }));
  },
};
