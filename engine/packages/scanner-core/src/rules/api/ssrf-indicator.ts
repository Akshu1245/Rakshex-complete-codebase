import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

const SSRF_KEYS = [
  "url",
  "uri",
  "callback",
  "webhook",
  "target",
  "redirect",
  "next",
  "return_url",
  "fetch",
  "image_url",
  "avatar_url",
];

export const ssrfIndicatorRule: ScanRule = {
  id: "api.ssrf_risk_indicator",
  name: "SSRF Risk Indicator",
  category: "injection",
  description:
    "Flags endpoints that accept URL-like query parameters which may enable server-side request forgery if not validated.",
  severity: "Medium",
  confidence: "potential",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-918"],
    owaspApi: ["API7:2023"],
  },
  evaluate(collection) {
    const findings = [];
    for (const ep of collection.endpoints) {
      const hits = ep.queryKeys.filter((k) =>
        SSRF_KEYS.some((s) => k.toLowerCase() === s || k.toLowerCase().endsWith(`_${s}`)),
      );
      if (hits.length === 0) continue;
      findings.push({
        ruleId: "api.ssrf_risk_indicator",
        title: "SSRF Risk Indicator",
        description: `${ep.method} ${ep.path} accepts URL-shaped parameters (${hits.join(", ")}). Without allowlists this can enable SSRF.`,
        severity: "Medium" as const,
        confidence: "potential" as const,
        category: "injection" as const,
        remediation:
          "Validate and allowlist destinations. Block link-local, private, and metadata IP ranges. Prefer server-side resource IDs over client-supplied URLs.",
        businessImpact: "Attackers may pivot into internal networks or cloud metadata services.",
        evidence: [
          {
            summary: `URL-like query keys: ${hits.join(", ")}`,
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-918"], owaspApi: ["API7:2023"] },
        fingerprint: fingerprint("api.ssrf_risk_indicator", ep.method, ep.path),
      });
    }
    return findings;
  },
};
