/**
 * Unified Risk Score Engine.
 *
 * This is the core surface of Patent NHCE/DEV/2026/001 — "A Method and System
 * for Unified Real-Time API Security Vulnerability Detection and Large
 * Language Model API Cost Intelligence Within IDEs".
 *
 * The patent claim is a single combined score per endpoint that fuses:
 *   - security severity (Critical/High/Medium/Low) — from OWASP scan
 *   - cost-anomaly ratio (current spend ÷ baseline spend) — from LLM tracking
 *
 * combined_score = w_sec × severity_norm + w_cost × cost_anomaly_norm
 *
 * Both inputs are normalised to [0, 1] before weighting so the resulting
 * score is also in [0, 1], where 1.0 = "stop the world" and < 0.2 = "ok".
 *
 * Defaults: w_sec = 0.6, w_cost = 0.4 (security weighted slightly higher
 * because exploit consequences are typically larger than spend overruns).
 *
 * The function is pure and deterministic — no DB, no I/O — so it can be
 * called from tRPC routes, the gateway, the VS Code extension, or batch
 * jobs without coordination.
 */

import { z } from "zod";

export type Severity = "Critical" | "High" | "Medium" | "Low" | "None";

const SEVERITY_NORM: Record<Severity, number> = {
  Critical: 1.0,
  High: 0.75,
  Medium: 0.5,
  Low: 0.25,
  None: 0,
};

export const unifiedRiskInputSchema = z.object({
  endpointId: z.string().min(1),
  /** Highest severity from any open finding for this endpoint. */
  highestSeverity: z.enum(["Critical", "High", "Medium", "Low", "None"]),
  /** Open-finding count — used as severity tie-breaker. */
  openFindings: z.number().int().min(0).default(0),
  /** Current period LLM spend attributed to this endpoint, in USD. */
  currentSpendUsd: z.number().min(0),
  /** Trailing-baseline LLM spend attributed to this endpoint, in USD. */
  baselineSpendUsd: z.number().min(0),
  /** Optional weights — must sum to ≤ 1; defaults are 0.6 / 0.4. */
  weights: z
    .object({
      security: z.number().min(0).max(1),
      cost: z.number().min(0).max(1),
    })
    .optional(),
});

export type UnifiedRiskInput = z.infer<typeof unifiedRiskInputSchema>;

export interface UnifiedRiskScore {
  endpointId: string;
  combined: number;
  band: "ok" | "watch" | "warn" | "alert" | "critical";
  components: {
    securityNorm: number;
    costNorm: number;
    securityWeight: number;
    costWeight: number;
  };
  inputs: {
    highestSeverity: Severity;
    openFindings: number;
    currentSpendUsd: number;
    baselineSpendUsd: number;
    costAnomalyRatio: number;
  };
}

const DEFAULT_WEIGHTS = { security: 0.6, cost: 0.4 } as const;

/**
 * Cost anomaly ratio. We treat baseline=0 specially:
 *   - if there is current spend with no baseline, ratio = 1 (full anomaly)
 *   - if both are 0, ratio = 0 (no signal)
 *
 * Above baseline we cap the raw ratio at 5× and then map [1×, 5×] → [0, 1].
 * Below baseline (current < baseline) is always 0 — under-spend is not a
 * risk we're surfacing here.
 */
export function costAnomalyRatio(currentUsd: number, baselineUsd: number): number {
  if (currentUsd <= 0) return 0;
  if (baselineUsd <= 0) return 1;
  const ratio = currentUsd / baselineUsd;
  if (ratio <= 1) return 0;
  // Map ratios in [1×, 5×] to a normalised [0, 1].
  const capped = Math.min(ratio, 5);
  return (capped - 1) / 4;
}

function bandFor(score: number): UnifiedRiskScore["band"] {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "alert";
  if (score >= 0.4) return "warn";
  if (score >= 0.2) return "watch";
  return "ok";
}

export function computeUnifiedRiskScore(raw: UnifiedRiskInput): UnifiedRiskScore {
  const input = unifiedRiskInputSchema.parse(raw);
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const wSum = weights.security + weights.cost;
  // Renormalise weights if the caller passed something other than 1.0 — keeps
  // the output in [0, 1] regardless of their preference.
  const wSec = wSum > 0 ? weights.security / wSum : DEFAULT_WEIGHTS.security;
  const wCost = wSum > 0 ? weights.cost / wSum : DEFAULT_WEIGHTS.cost;

  const baseSeverity = SEVERITY_NORM[input.highestSeverity];
  // Tie-break: if multiple findings of the same severity, nudge upward.
  // log1p keeps growth bounded so even 100 findings only adds ~0.05.
  const findingBoost = Math.min(0.1, Math.log1p(input.openFindings) / 50);
  const securityNorm = Math.min(1, baseSeverity + findingBoost);

  const costNorm = costAnomalyRatio(input.currentSpendUsd, input.baselineSpendUsd);

  const combined = Math.min(1, wSec * securityNorm + wCost * costNorm);

  return {
    endpointId: input.endpointId,
    combined: Number(combined.toFixed(4)),
    band: bandFor(combined),
    components: {
      securityNorm: Number(securityNorm.toFixed(4)),
      costNorm: Number(costNorm.toFixed(4)),
      securityWeight: wSec,
      costWeight: wCost,
    },
    inputs: {
      highestSeverity: input.highestSeverity,
      openFindings: input.openFindings,
      currentSpendUsd: input.currentSpendUsd,
      baselineSpendUsd: input.baselineSpendUsd,
      costAnomalyRatio: Number(
        costAnomalyRatio(input.currentSpendUsd, input.baselineSpendUsd).toFixed(4),
      ),
    },
  };
}

/**
 * Bulk variant: compute scores for many endpoints and sort descending.
 * Useful for dashboards (top-10 riskiest endpoints right now).
 */
export function rankByUnifiedRisk(inputs: UnifiedRiskInput[]): UnifiedRiskScore[] {
  return inputs.map(computeUnifiedRiskScore).sort((a, b) => b.combined - a.combined);
}
