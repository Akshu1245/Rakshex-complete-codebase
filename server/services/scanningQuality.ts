/**
 * Scanning Quality Engine
 *
 * Adds confidence scoring, deduplication, severity normalization,
 * and explainability to all security findings.
 *
 * Every finding must answer:
 *   - WHAT happened
 *   - WHY it matters
 *   - HOW dangerous it is
 *   - HOW to fix it
 *   - HOW confident DevPulse is
 */

export type ConfidenceLevel = "low" | "medium" | "high" | "critical";

export interface EnrichedFinding {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  confidence: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  description: string;
  category: string;
  remediation: string;
  cweId: string;
  owaspId?: string;

  // Explainability — answers the 5 questions
  whatHappened: string;
  whyItMatters: string;
  howDangerous: string;
  howToFix: string;
  fixConfidence: number; // 0-100

  // Context
  endpoint?: string;
  method?: string;
  evidence: string[]; // Specific evidence snippets
  references: string[]; // URLs to OWASP, CWE, etc.

  // Deduplication key
  fingerprint: string;

  // Suppression
  suppressible: boolean;
  suppressionReason?: string;
}

interface DeduplicationKey {
  endpoint: string;
  method: string;
  category: string;
  cweId: string;
}

/**
 * Calculate confidence score (0-100) based on evidence strength.
 */
export function calculateConfidence(
  evidenceCount: number,
  hasEndpoint: boolean,
  hasMethod: boolean,
  patternMatchStrength: number, // 0-1
): number {
  let score = 30; // Base confidence

  // Evidence quality
  score += Math.min(evidenceCount * 10, 30);

  // Context richness
  if (hasEndpoint) score += 15;
  if (hasMethod) score += 10;

  // Pattern match strength (exact match vs heuristic)
  score += patternMatchStrength * 25;

  return Math.min(100, Math.round(score));
}

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

/**
 * Normalize severity based on confidence.
 * Low-confidence Critical findings become High.
 * High-confidence Medium findings can become High.
 */
export function normalizeSeverity(
  severity: "Critical" | "High" | "Medium" | "Low",
  confidence: number,
): "Critical" | "High" | "Medium" | "Low" {
  const severityOrder = ["Low", "Medium", "High", "Critical"] as const;
  const idx = severityOrder.indexOf(severity);

  // Low confidence: downgrade by 1 level (minimum Low)
  if (confidence < 40 && idx > 0) {
    return severityOrder[idx - 1];
  }

  // High confidence: upgrade by 1 level (maximum Critical)
  if (confidence >= 90 && idx < 3) {
    return severityOrder[idx + 1];
  }

  return severity;
}

/**
 * Generate a unique fingerprint for deduplication.
 */
export function generateFingerprint(
  endpoint: string,
  method: string,
  category: string,
  cweId: string,
): string {
  const normalizedEndpoint = endpoint.replace(/\d+/g, ":id").toLowerCase();
  const normalizedMethod = method.toUpperCase();
  const hash = `${normalizedMethod}:${normalizedEndpoint}:${category}:${cweId}`;
  // Simple hash — collisions are acceptable (same endpoint + category + CWE = same issue)
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(h).toString(36)}`;
}

/**
 * Deduplicate findings by fingerprint.
 * When duplicates exist, merge evidence and take highest confidence.
 */
export function deduplicateFindings(findings: EnrichedFinding[]): EnrichedFinding[] {
  const map = new Map<string, EnrichedFinding>();

  for (const finding of findings) {
    const existing = map.get(finding.fingerprint);
    if (existing) {
      // Merge evidence
      const mergedEvidence = [...new Set([...existing.evidence, ...finding.evidence])];
      existing.evidence = mergedEvidence.slice(0, 5); // Cap at 5 evidence items

      // Take highest confidence
      if (finding.confidence > existing.confidence) {
        existing.confidence = finding.confidence;
        existing.confidenceLevel = confidenceLevel(finding.confidence);
      }

      // Take highest severity
      const severityOrder = ["Low", "Medium", "High", "Critical"] as const;
      if (severityOrder.indexOf(finding.severity) > severityOrder.indexOf(existing.severity)) {
        existing.severity = finding.severity;
      }

      existing.references = [...new Set([...existing.references, ...finding.references])];
    } else {
      map.set(finding.fingerprint, { ...finding });
    }
  }

  return Array.from(map.values());
}

/**
 * Prioritize findings by: severity → confidence → fix confidence.
 */
export function prioritizeFindings(findings: EnrichedFinding[]): EnrichedFinding[] {
  const severityWeight: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

  return [...findings].sort((a, b) => {
    // Primary: severity
    const sevDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;

    // Secondary: confidence
    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;

    // Tertiary: fix confidence (easier fixes first)
    return b.fixConfidence - a.fixConfidence;
  });
}

/**
 * Enrich a raw finding with explainability and quality fields.
 */
export function enrichFinding(raw: {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  category: string;
  remediation: string;
  cweId: string;
  endpoint?: string;
  method?: string;
  evidence?: string[];
  owaspId?: string;
}): EnrichedFinding {
  const evidence = raw.evidence || [raw.description.slice(0, 200)];
  const confidence = calculateConfidence(
    evidence.length,
    Boolean(raw.endpoint),
    Boolean(raw.method),
    0.7, // Default pattern match strength
  );

  const normalizedSeverity = normalizeSeverity(raw.severity, confidence);

  const whyItMattersMap: Record<string, string> = {
    "Cryptographic Failures":
      "Unencrypted traffic exposes sensitive data to interception by attackers on the same network.",
    "Broken Authentication":
      "Missing authentication allows anyone to modify data, potentially leading to data breaches or unauthorized access.",
    "Broken Access Control":
      "Insecure object references let attackers access other users' data by guessing IDs.",
    "Security Misconfiguration":
      "Debug headers and verbose errors leak internal architecture that attackers can exploit.",
    Injection:
      "Unsanitized input can execute malicious code on your server, leading to full system compromise.",
    "Secrets Management":
      "Exposed API keys allow attackers to impersonate your application and access paid services at your expense.",
  };

  const howDangerousMap: Record<string, string> = {
    Critical:
      "This could lead to immediate data breach, financial loss, or complete system compromise.",
    High: "This significantly weakens security and could be exploited by skilled attackers.",
    Medium:
      "This creates a vulnerability that could be chained with other issues for exploitation.",
    Low: "This is a hygiene issue that should be fixed but poses limited immediate risk.",
  };

  return {
    id: raw.id,
    title: raw.title,
    severity: normalizedSeverity,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    description: raw.description,
    category: raw.category,
    remediation: raw.remediation,
    cweId: raw.cweId,
    owaspId: raw.owaspId,

    whatHappened: raw.description,
    whyItMatters:
      Object.entries(whyItMattersMap).find(([k]) => raw.category.includes(k))?.[1] ||
      "This vulnerability could be exploited by attackers to compromise your application or data.",
    howDangerous: howDangerousMap[normalizedSeverity],
    howToFix: raw.remediation,
    fixConfidence: Math.min(100, confidence + 10),

    endpoint: raw.endpoint,
    method: raw.method,
    evidence,
    references: [
      `https://cwe.mitre.org/data/definitions/${raw.cweId.replace("CWE-", "")}.html`,
      ...(raw.owaspId ? [`https://owasp.org/Top10/${raw.owaspId}/`] : []),
    ],

    fingerprint: generateFingerprint(raw.endpoint || "", raw.method || "", raw.category, raw.cweId),

    suppressible: true,
  };
}
