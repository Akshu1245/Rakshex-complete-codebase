import { normalizeCollection } from "./normalize.js";
import { DEFAULT_API_RULES } from "./rules/registry.js";
import type { LegacyFinding, RuleFinding, ScanResult, ScanRule, Severity } from "./types.js";

export interface RunScanOptions {
  /** Subset of rules; defaults to full API pack. */
  rules?: ScanRule[];
  /** When set, only run rules whose id is in this list. */
  onlyRuleIds?: string[];
}

function severityRank(s: Severity): number {
  switch (s) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    case "Low":
      return 1;
    default:
      return 0;
  }
}

/**
 * Run deterministic scanner rules against Postman/OpenAPI input.
 */
export function runScan(rawCollection: unknown, options: RunScanOptions = {}): ScanResult {
  const started = Date.now();
  const collection = normalizeCollection(rawCollection);
  let rules = options.rules ?? DEFAULT_API_RULES;
  if (options.onlyRuleIds?.length) {
    const allow = new Set(options.onlyRuleIds);
    rules = rules.filter((r) => allow.has(r.id));
  }

  const byFingerprint = new Map<string, RuleFinding>();
  const rulesRun: string[] = [];

  for (const rule of rules) {
    rulesRun.push(rule.id);
    const hits = rule.evaluate(collection);
    for (const finding of hits) {
      const existing = byFingerprint.get(finding.fingerprint);
      if (!existing || severityRank(finding.severity) > severityRank(existing.severity)) {
        byFingerprint.set(finding.fingerprint, finding);
      }
    }
  }

  const findings = [...byFingerprint.values()].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );

  return {
    findings,
    rulesRun,
    endpointCount: collection.endpoints.length,
    durationMs: Date.now() - started,
  };
}

/** Map engine findings into the shape historically used by server/utils/scanning.ts */
export function toLegacyFindings(
  findings: RuleFinding[],
  idFactory: () => string,
): LegacyFinding[] {
  return findings.map((f) => {
    const cwe = f.standards.cwe?.[0] ?? "CWE-0";
    const owasp = f.standards.owaspApi?.[0];
    const categoryLabel = owasp
      ? `${humanCategory(f.category)} (${owasp})`
      : humanCategory(f.category);

    return {
      id: idFactory(),
      title: f.title,
      severity: f.severity,
      description: f.description,
      category: categoryLabel,
      remediation: f.remediation,
      cweId: cwe,
      ruleId: f.ruleId,
      confidence: f.confidence,
      endpoint: f.endpoint,
      method: f.method,
    };
  });
}

function humanCategory(cat: string): string {
  switch (cat) {
    case "authentication":
      return "Broken Authentication";
    case "authorization":
      return "Broken Access Control";
    case "cryptography":
      return "Cryptographic Failures";
    case "injection":
      return "Injection";
    case "misconfiguration":
      return "Security Misconfiguration";
    case "data_exposure":
      return "Excessive Data Exposure";
    case "logging":
      return "Security Logging Failures";
    case "ai_agent":
      return "AI / Agent Security";
    case "network":
      return "Network Security";
    default:
      return "Security Finding";
  }
}

export function calculateRiskScore(findings: Array<{ severity: Severity }>): number {
  let score = 0;
  for (const finding of findings) {
    if (finding.severity === "Critical") score += 30;
    else if (finding.severity === "High") score += 20;
    else if (finding.severity === "Medium") score += 10;
    else if (finding.severity === "Low") score += 5;
  }
  return Math.min(100, score);
}

export function getRiskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}
