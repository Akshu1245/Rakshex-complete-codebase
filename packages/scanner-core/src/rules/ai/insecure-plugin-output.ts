import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

/**
 * Flags endpoints that return or pass plugin/tool output without sanitization markers.
 */
export const insecurePluginOutputRule: ScanRule = {
  id: "ai.insecure_plugin_output",
  name: "Insecure Plugin / Tool Output Handling",
  category: "ai_agent",
  description:
    "Detects agent plugin/tool responses that may be re-injected into prompts or rendered without sanitization.",
  severity: "Medium",
  confidence: "informational",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-79"],
    owaspLlm: ["LLM02:2025"],
  },
  evaluate(collection) {
    const findings = [];
    for (const ep of collection.endpoints) {
      const hay = `${ep.name ?? ""} ${ep.path} ${ep.url}`.toLowerCase();
      if (!/plugin|tool.?result|mcp|function.?call|tool.?output/.test(hay)) continue;

      findings.push({
        ruleId: "ai.insecure_plugin_output",
        title: "Plugin/Tool Output May Be Untrusted",
        description: `${ep.method} ${ep.path} appears related to plugin/tool output; treat as untrusted data.`,
        severity: "Medium" as const,
        confidence: "informational" as const,
        category: "ai_agent" as const,
        remediation:
          "Sanitize tool outputs before display or re-prompting; never execute tool results as code.",
        evidence: [
          {
            summary: "Endpoint name/path indicates plugin or tool output",
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-79"], owaspLlm: ["LLM02:2025"] },
        fingerprint: fingerprint("ai.insecure_plugin_output", ep.method, ep.path),
      });
    }
    return findings;
  },
};
