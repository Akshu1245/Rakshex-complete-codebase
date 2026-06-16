/**
 * Compliance Report Engine — maps scan findings to compliance frameworks.
 *
 * Frameworks supported:
 *   - OWASP API Top 10 (2023)
 *   - OWASP LLM Top 10
 *   - DPDP Act 2023 (India)
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "na";
  severity: "low" | "medium" | "high" | "critical";
  evidence: string[];
  remediation: string;
}

export interface ComplianceReport {
  framework: string;
  generatedAt: string;
  controls: ComplianceControl[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    na: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Framework definitions
// ─────────────────────────────────────────────────────────────────────────

interface FrameworkControlDef {
  id: string;
  name: string;
  description: string;
  findingKeywords: string[];
}

const OWASP_API_TOP_10: FrameworkControlDef[] = [
  {
    id: "API1",
    name: "Broken Object Level Authorization",
    description: "Missing authorization checks on object access",
    findingKeywords: ["authorization", "auth", "access control", "bola", "id access"],
  },
  {
    id: "API2",
    name: "Broken Authentication",
    description: "Weak JWT, missing rate limits, no MFA",
    findingKeywords: ["jwt", "weak auth", "rate limit", "mfa", "2fa", "token"],
  },
  {
    id: "API3",
    name: "Broken Object Property Level Authorization",
    description: "Mass assignment / excessive data exposure",
    findingKeywords: ["mass assignment", "property level", "field access"],
  },
  {
    id: "API4",
    name: "Unrestricted Resource Consumption",
    description: "No rate limits, no pagination, resource exhaustion",
    findingKeywords: [
      "rate limit",
      "rate-limiting",
      "pagination",
      "resource consumption",
      "token limit",
    ],
  },
  {
    id: "API5",
    name: "Broken Function Level Authorization",
    description: "Function-level auth bypass",
    findingKeywords: ["function level", "bfle", "role bypass", "admin endpoint"],
  },
  {
    id: "API6",
    name: "Unrestricted Access to Sensitive Business Flows",
    description: "Abuse of legitimate business functionality",
    findingKeywords: ["business flow", "abuse", "automation", "scraping"],
  },
  {
    id: "API7",
    name: "Server-Side Request Forgery",
    description: "SSRF vulnerabilities",
    findingKeywords: ["ssrf", "169.254", "metadata", "localhost", "internal"],
  },
  {
    id: "API8",
    name: "Security Misconfiguration",
    description: "Exposed keys, debug endpoints, verbose errors",
    findingKeywords: [
      "exposed key",
      "debug endpoint",
      "misconfiguration",
      "credential",
      "secret",
      "api key",
    ],
  },
  {
    id: "API9",
    name: "Improper Inventory Management",
    description: "Shadow APIs, deprecated versions, undocumented endpoints",
    findingKeywords: ["shadow api", "undocumented", "deprecated", "inventory", "zombie"],
  },
  {
    id: "API10",
    name: "Unsafe API Consumption",
    description: "Unvalidated external API responses",
    findingKeywords: ["external api", "unvalidated", "untrusted input", "third party"],
  },
];

const OWASP_LLM_TOP_10: FrameworkControlDef[] = [
  {
    id: "LLM01",
    name: "Prompt Injection",
    description: "Direct/indirect prompt injection attacks",
    findingKeywords: [
      "prompt injection",
      "injection",
      "jailbreak",
      "ignore instructions",
      "override",
    ],
  },
  {
    id: "LLM02",
    name: "Insecure Output Handling",
    description: "Unsanitized LLM output rendered as HTML/markdown",
    findingKeywords: ["output handling", "xss", "html", "markdown injection", "sanitize"],
  },
  {
    id: "LLM04",
    name: "Model Denial of Service",
    description: "Resource exhaustion through excessive token usage or loops",
    findingKeywords: ["denial of service", "resource exhaustion", "recursive", "loop", "infinite"],
  },
  {
    id: "LLM06",
    name: "Sensitive Information Disclosure",
    description: "PII/secret leakage in LLM responses",
    findingKeywords: [
      "pii",
      "leak",
      "exfiltration",
      "sensitive information",
      "email leak",
      "credential leak",
    ],
  },
  {
    id: "LLM07",
    name: "Insecure Plugin Design",
    description: "MCP/tool security — excessive permissions, no input validation",
    findingKeywords: ["mcp", "tool", "plugin", "permission", "sandbox", "exec"],
  },
];

const DPDP_ACT_2023: FrameworkControlDef[] = [
  {
    id: "DPDP-S4",
    name: "Section 4 — PII in API Responses Without Consent",
    description: "Personal data returned in API responses must have consent basis",
    findingKeywords: ["pii", "personal data", "consent", "data subject", "user data leak"],
  },
  {
    id: "DPDP-S8",
    name: "Section 8 — Data Minimization Violations",
    description: "APIs must not return excessive personal data",
    findingKeywords: ["excessive data", "minimization", "overfetching", "data scope"],
  },
  {
    id: "DPDP-S9",
    name: "Section 9 — Children's Data Without Verifiable Consent",
    description: "APIs handling children's data require age verification + guardian consent",
    findingKeywords: ["children", "minor", "age verification", "guardian consent"],
  },
];

const FRAMEWORKS: Record<string, FrameworkControlDef[]> = {
  "owasp-api": OWASP_API_TOP_10,
  "owasp-llm": OWASP_LLM_TOP_10,
  "dpdp-2023": DPDP_ACT_2023,
};

// ─────────────────────────────────────────────────────────────────────────
// Report generation
// ─────────────────────────────────────────────────────────────────────────

interface FindingLike {
  title: string;
  description?: string;
  severity: string;
  category?: string;
}

export function generateReport(
  scanFindings: FindingLike[],
  frameworks: string[],
): ComplianceReport[] {
  return frameworks.map((fw) => {
    const controls = FRAMEWORKS[fw] ?? [];
    const results = controls.map((control) => {
      const matchingFindings = scanFindings.filter((f) => {
        const haystack = `${f.title} ${f.description ?? ""} ${f.category ?? ""}`.toLowerCase();
        return control.findingKeywords.some((kw) => haystack.includes(kw));
      });

      const status: "pass" | "fail" | "na" =
        matchingFindings.length === 0
          ? "na"
          : matchingFindings.every((f) => f.severity === "Low")
            ? "pass"
            : "fail";

      const maxSeverity =
        matchingFindings.length > 0
          ? ((["Low", "Medium", "High", "Critical"]
              .filter((s) => matchingFindings.some((f) => f.severity === s))
              .pop() ?? "medium") as ComplianceControl["severity"])
          : "low";

      return {
        id: control.id,
        name: control.name,
        description: control.description,
        status,
        severity: maxSeverity,
        evidence: matchingFindings.map((f) => f.title),
        remediation:
          matchingFindings.length > 0
            ? `Address ${matchingFindings.length} finding(s) to pass this control.`
            : "No applicable findings — control not assessed.",
      };
    });

    return {
      framework: fw,
      generatedAt: new Date().toISOString(),
      controls: results,
      summary: {
        total: results.length,
        pass: results.filter((c) => c.status === "pass").length,
        fail: results.filter((c) => c.status === "fail").length,
        na: results.filter((c) => c.status === "na").length,
      },
    };
  });
}
