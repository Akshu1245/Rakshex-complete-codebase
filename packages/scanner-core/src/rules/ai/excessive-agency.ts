import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

const DANGEROUS_TOOLS =
  /\b(shell|exec|eval|rm\s+-rf|drop\s+table|delete\s+from|transfer|wire|sudo)\b/i;
const TOOL_PATH = /\/(tools?|actions?|agent|mcp|invoke|execute)\b/i;

/**
 * Flags agent tool-invocation endpoints that look over-privileged.
 */
export const excessiveAgencyRule: ScanRule = {
  id: "ai.excessive_agency",
  name: "Excessive Agent Agency",
  category: "ai_agent",
  description:
    "Detects agent/tool endpoints that may allow high-impact actions without step-up auth markers.",
  severity: "Critical",
  confidence: "potential",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-250"],
    owaspLlm: ["LLM06:2025"],
  },
  evaluate(collection) {
    const findings = [];
    for (const ep of collection.endpoints) {
      if (!TOOL_PATH.test(ep.path) && !TOOL_PATH.test(ep.url)) continue;
      const mutating = ["POST", "PUT", "DELETE", "PATCH"].includes(ep.method);
      if (!mutating) continue;

      const headerBlob = ep.headers.map((h) => `${h.key}=${h.value}`).join(" ");
      const nameBlob = `${ep.name ?? ""} ${ep.path}`;
      const dangerous = DANGEROUS_TOOLS.test(headerBlob) || DANGEROUS_TOOLS.test(nameBlob);

      findings.push({
        ruleId: "ai.excessive_agency",
        title: dangerous
          ? "Agent Endpoint Suggests High-Impact Tooling"
          : "Agent Tool Endpoint Without Explicit Guardrails",
        description: `${ep.method} ${ep.path} looks like an agent/tool invocation surface${
          dangerous ? " with high-impact action indicators" : ""
        }.`,
        severity: dangerous ? ("Critical" as const) : ("High" as const),
        confidence: dangerous ? ("high" as const) : ("potential" as const),
        category: "ai_agent" as const,
        remediation:
          "Require human approval for high-impact tools, scope tool permissions, and deny shell/DB/payment tools by default.",
        evidence: [
          {
            summary: dangerous
              ? "Path/name indicates agent tool with dangerous action keywords"
              : "Agent/tool invocation path on mutating method",
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-250"], owaspLlm: ["LLM06:2025"] },
        fingerprint: fingerprint("ai.excessive_agency", ep.method, ep.path),
      });
    }
    return findings;
  },
};
