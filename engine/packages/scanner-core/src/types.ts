/**
 * @rakshex/scanner-core — shared rule and finding contracts.
 *
 * Rules must only emit findings when evidence supports them.
 * Confidence labels: confirmed | high | potential | informational
 */

export type Severity = "Critical" | "High" | "Medium" | "Low";

export type ConfidenceLabel = "confirmed" | "high" | "potential" | "informational";

export type FindingCategory =
  | "authentication"
  | "authorization"
  | "cryptography"
  | "injection"
  | "misconfiguration"
  | "data_exposure"
  | "logging"
  | "ai_agent"
  | "network"
  | "other";

export interface RuleStandards {
  cwe?: string[];
  owaspApi?: string[];
  owaspLlm?: string[];
  pci?: string[];
}

export interface NormalizedHeader {
  key: string;
  value: string;
}

export interface NormalizedEndpoint {
  /** Display URL (may be relative or absolute). */
  url: string;
  path: string;
  method: string;
  headers: NormalizedHeader[];
  /** True when OpenAPI/Postman declares a security scheme on this op or global. */
  hasDeclaredSecurity?: boolean;
  /** Query string keys only (values redacted for safety). */
  queryKeys: string[];
  source: "postman" | "openapi" | "unknown";
  name?: string;
}

export interface NormalizedCollection {
  endpoints: NormalizedEndpoint[];
  format: "postman" | "openapi" | "mixed" | "empty";
  raw: unknown;
}

export interface RuleEvidence {
  summary: string;
  location?: string;
  snippet?: string;
}

export interface RuleFinding {
  ruleId: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: ConfidenceLabel;
  category: FindingCategory;
  remediation: string;
  businessImpact?: string;
  evidence: RuleEvidence[];
  endpoint?: string;
  method?: string;
  standards: RuleStandards;
  /** Stable fingerprint for dedup (rule + method + path). */
  fingerprint: string;
}

export interface ScanRule {
  id: string;
  name: string;
  category: FindingCategory;
  description: string;
  severity: Severity;
  confidence: ConfidenceLabel;
  version: string;
  standards: RuleStandards;
  /** Pure detection — no I/O. */
  evaluate: (collection: NormalizedCollection) => RuleFinding[];
}

export interface ScanResult {
  findings: RuleFinding[];
  rulesRun: string[];
  endpointCount: number;
  durationMs: number;
}

export interface LegacyFinding {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  category: string;
  remediation: string;
  cweId: string;
  ruleId?: string;
  confidence?: ConfidenceLabel;
  endpoint?: string;
  method?: string;
}
