import { fingerprint } from "../../normalize.js";
import type { ScanRule } from "../../types.js";

const INJECTION_HINTS =
  /\b(ignore\s+previous|system\s*prompt|jailbreak|DAN\s+mode|override\s+instructions)\b/i;
const USER_CONTROLLED_BODY = /\{\{.*\}\}|\$\{|req\.body|userInput|prompt\s*:/i;

/**
 * Flags endpoints that appear to accept free-form prompts without clear input validation markers.
 */
export const promptInjectionSurfaceRule: ScanRule = {
  id: "ai.prompt_injection_surface",
  name: "LLM Prompt Injection Surface",
  category: "ai_agent",
  description:
    "Detects agent/LLM endpoints that pass user-controlled text into prompts without validation markers.",
  severity: "High",
  confidence: "potential",
  version: "1.0.0",
  standards: {
    cwe: ["CWE-77"],
    owaspLlm: ["LLM01:2025"],
  },
  evaluate(collection) {
    const findings = [];
    for (const ep of collection.endpoints) {
      const hay = `${ep.name ?? ""} ${ep.path} ${ep.url}`.toLowerCase();
      const looksLlm = /chat|completion|prompt|agent|llm|copilot|generate|assistant/.test(hay);
      if (!looksLlm) continue;

      const headerBlob = ep.headers.map((h) => `${h.key}:${h.value}`).join(" ");
      const risky =
        INJECTION_HINTS.test(headerBlob) ||
        USER_CONTROLLED_BODY.test(headerBlob) ||
        ep.queryKeys.some((k) => /prompt|message|input|query/.test(k.toLowerCase())) ||
        /prompt|message|input|chat|completion/.test(ep.path.toLowerCase());

      // LLM-like surfaces are always reportable at least as potential
      if (!risky && ep.method === "GET") continue;

      findings.push({
        ruleId: "ai.prompt_injection_surface",
        title: "Potential Prompt Injection Surface",
        description: `${ep.method} ${ep.path} appears to accept free-form text that may be concatenated into an LLM prompt.`,
        severity: "High" as const,
        confidence: "potential" as const,
        category: "ai_agent" as const,
        remediation:
          "Separate system instructions from user content, apply input allowlists, and use structured tool schemas instead of free-form prompt concatenation.",
        evidence: [
          {
            summary: "LLM-like endpoint with user-controlled input indicators",
            location: `${ep.method} ${ep.path}`,
          },
        ],
        endpoint: ep.path,
        method: ep.method,
        standards: { cwe: ["CWE-77"], owaspLlm: ["LLM01:2025"] },
        fingerprint: fingerprint("ai.prompt_injection_surface", ep.method, ep.path),
      });
    }
    return findings;
  },
};
