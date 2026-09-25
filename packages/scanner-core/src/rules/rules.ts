import { fingerprint, hasAuthHeader } from "../normalize.js";
import type { ScanRule } from "../types.js";

// ── from debug-headers.ts ──
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

// ── from idor-indicator.ts ──
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

// ── from insecure-http.ts ──
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

// ── from missing-auth.ts ──
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

// ── from missing-correlation.ts ──
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

// ── from sensitive-query.ts ──
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

// ── from ssrf-indicator.ts ──
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

// ── from excessive-agency.ts ──
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

// ── from insecure-plugin-output.ts ──
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

// ── from prompt-injection-surface.ts ──
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
