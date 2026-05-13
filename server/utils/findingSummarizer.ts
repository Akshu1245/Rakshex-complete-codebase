/**
 * LLM-powered finding summariser. Takes raw scan findings and produces a
 * concise, triage-focused natural-language summary that security engineers
 * can paste straight into a ticket or Slack thread.
 *
 * Owns a DevPulse-tuned system prompt — deliberately *not* copied from any
 * third-party agent. The prompt is specific to security-finding triage
 * (severity framing, actionable next steps, no invented CVEs).
 */

import { invokeLLM, type Message } from "../_core/llm";
import { logger } from "../_core/logger";

export interface SummaryFinding {
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description?: string | null;
  category?: string | null;
  remediation?: string | null;
  cweId?: string | null;
  endpoint?: string;
  method?: string;
}

export interface SummaryRequest {
  scanId: string;
  collectionName: string;
  scanType: string;
  findings: SummaryFinding[];
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  userId?: number;
}

export interface SummaryResult {
  summary: string;
  topRisks: string[];
  suggestedNextAction: string;
}

/**
 * DevPulse finding-triage system prompt. Reviewed & tuned by hand — every
 * sentence in here is deliberate.
 *
 * Design notes:
 * - No "You are a helpful assistant" preamble; we want a role-specific
 *   security engineer persona.
 * - Explicit refusal rules for hallucinating CVEs — a previous spot check
 *   showed models love to invent plausible-looking CVE-2021-XXXXX strings.
 * - Severity framing is prescriptive so the output reads consistently
 *   across different models.
 * - Output shape is locked via json_schema below, not prose instructions,
 *   so even models that skip "respond in JSON" literal instructions will
 *   comply.
 */
const SYSTEM_PROMPT = `You are DevPulse's security-triage analyst. You help engineers
understand the output of a static API security scan by writing concise,
actionable summaries.

Your output is read by engineers who will decide whether to drop everything
and fix something, file a ticket for later, or mark it as accepted risk. So:

- Lead with the blast radius. If a Critical finding could leak production
  credentials or allow unauthenticated data deletion, say that first.
- Group by category (auth, transport, injection, logging) — not by severity
  — so a reader sees related issues together.
- Never invent CVE IDs, CVSS scores, exploit chains, or product names. If
  you don't know, don't guess. The raw scan data is authoritative.
- Never recommend "hire a professional". Users already did, they hired
  DevPulse. Give them the fix, don't punt.
- If there are no Critical/High findings, say so plainly — don't pad.

Write for a senior backend engineer who is skim-reading in Slack. No
greetings, no closings, no emoji.`;

/**
 * JSON schema pinning the output shape so downstream renderers
 * (dashboard, VS Code extension) can rely on field presence.
 */
const OUTPUT_SCHEMA = {
  name: "finding_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "topRisks", "suggestedNextAction"],
    properties: {
      summary: {
        type: "string",
        description:
          "2-5 sentences of prose, grouped by category, leading with highest-impact issue.",
      },
      topRisks: {
        type: "array",
        maxItems: 5,
        items: { type: "string" },
        description:
          "Bullet list of the 1-5 most important findings to act on, each ≤ 120 chars.",
      },
      suggestedNextAction: {
        type: "string",
        description:
          "One concrete next action the engineer should take today, ≤ 160 chars.",
      },
    },
  },
};

function buildUserMessage(req: SummaryRequest): string {
  // Truncate very long finding lists so the prompt stays under model limits.
  // We prioritise Critical > High > Medium > Low.
  const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
  const sorted = [...req.findings].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity]
  );
  const MAX_FINDINGS = 80;
  const trimmed = sorted.slice(0, MAX_FINDINGS);
  const truncated =
    sorted.length > MAX_FINDINGS
      ? `\n(${sorted.length - MAX_FINDINGS} lower-severity findings omitted for brevity.)`
      : "";

  const findingLines = trimmed
    .map((f, idx) => {
      const loc =
        f.endpoint || f.method ? ` [${f.method || ""} ${f.endpoint || ""}]` : "";
      const remediation = f.remediation ? ` Fix: ${f.remediation}` : "";
      return `${idx + 1}. [${f.severity}] ${f.title}${loc} — ${f.category ?? "uncategorised"}.${remediation}`;
    })
    .join("\n");

  return `Scan metadata:
- Collection: ${req.collectionName}
- Scan type: ${req.scanType}
- Overall risk: ${req.riskLevel} (${req.riskScore}/100)
- Total findings: ${req.findings.length}

Findings (highest severity first):
${findingLines}${truncated}

Produce a triage summary conforming to the schema.`;
}

export async function summarizeFindings(
  req: SummaryRequest
): Promise<SummaryResult> {
  if (req.findings.length === 0) {
    return {
      summary: `Clean scan — ${req.scanType} scan of ${req.collectionName} produced no findings. No action required.`,
      topRisks: [],
      suggestedNextAction: "Schedule the next scan on your regular cadence.",
    };
  }

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(req) },
  ];

  const result = await invokeLLM({
    messages,
    outputSchema: OUTPUT_SCHEMA,
    userId: req.userId,
    maxTokens: 800,
  });

  // invokeLLM returns OpenAI-shape responses; the JSON is in the first
  // choice's content.
  const raw = result.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw
    .map(p => ("text" in p ? p.text : ""))
    .join("") : "";

  try {
    const parsed = JSON.parse(text) as SummaryResult;
    return {
      summary: parsed.summary,
      topRisks: parsed.topRisks ?? [],
      suggestedNextAction: parsed.suggestedNextAction ?? "",
    };
  } catch (err) {
    // Model returned non-JSON despite the schema — fall back to raw text
    // rather than crashing the request.
    logger.warn({ err: err }, "[findingSummarizer] LLM returned non-JSON; falling back");
    return {
      summary: text.trim() || "Unable to generate summary at this time.",
      topRisks: [],
      suggestedNextAction:
        "Review the findings list in the dashboard; summariser output was unparseable.",
    };
  }
}
