import type { Impact, RepairRule } from "./types.js";
import { siteId } from "./types.js";

export type Level = "LOW" | "HIGH";
export interface Assessment { id: string; impact: Impact; rule: RepairRule | null; level: Level; reasons: string[]; autoApprovable: boolean }

/** Deterministic rules. Anything not provably mechanical goes to a human. */
export function assess(impact: Impact, rules: RepairRule[], siteValues: Record<string, string> = {}): Assessment {
  const reasons: string[] = [];
  const rule = rules.find((r) => r.path === impact.change.path && r.removed === impact.change.property && r.changeIds.includes(impact.change.id)) ?? null;
  let level: Level = "LOW";
  if (!rule) { level = "HIGH"; reasons.push("No documented mechanical repair rule for this change; a human must write the fix."); }
  if (impact.verdict !== "breaks_call") { level = "HIGH"; reasons.push(`Verdict is ${impact.verdict}, not a proven break.`); }
  if (impact.evidence.payloadStatus !== "resolved") { level = "HIGH"; reasons.push(`Payload only ${impact.evidence.payloadStatus}ly resolved: ${impact.evidence.unresolved.join("; ") || "unknown parts"}.`); }
  // A documented behaviour change is acceptable only when the rule's low-risk value set proves it moot
  // (e.g. card-only: "silently filters incompatible methods" cannot drop anything).
  if (impact.semanticWarning) {
    reasons.push(`Behaviour change: ${impact.semanticWarning.note} (${impact.semanticWarning.source})`);
    if (!rule?.lowRiskValues) level = "HIGH";
  }
  if (rule?.lowRiskValues) {
    const v = siteValues[rule.removed];
    if (v === undefined) { level = "HIGH"; reasons.push(`Value of \`${rule.removed}\` is not a static literal; cannot prove equivalence.`); }
    else {
      const vals = v.replace(/^\[|\]$/g, "").split(",").filter(Boolean);
      const odd = vals.filter((x) => !rule.lowRiskValues!.includes(x));
      if (odd.length) { level = "HIGH"; reasons.push(`Values [${odd.join(", ")}] are outside the low-risk set [${rule.lowRiskValues.join(", ")}].`); }
    }
  }
  reasons.push("NOT checked by RaksHex: error-handling code that relied on the old 400 error, and provider Dashboard settings. A human must confirm before merge.");
  return { id: siteId(impact), impact, rule, level, reasons, autoApprovable: level === "LOW" };
}
