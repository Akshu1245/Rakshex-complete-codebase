/**
 * Thinking-Token Cost Attribution Engine
 *
 * God Mode Feature: Nobody in the industry breaks out reasoning/thinking tokens
 * from output tokens. OpenAI o1/o3/o4 and Anthropic's extended thinking consume
 * massive hidden tokens that don't appear in standard completion_tokens.
 * This engine fixes that.
 *
 * Real pain point from users: "My cost reports are wrong because reasoning
 * tokens cost 4x more than output tokens and I can't see them separately."
 */

import * as db from "../db";
import { logger } from "../_core/logger";

// ── Pricing per 1K tokens (USD) ─────────────────────────────────────────────

interface TokenPricing {
  prompt: number;
  completion: number;
  reasoning: number; // thinking/reasoning tokens — usually 4x completion
}

const THINKING_MODEL_PRICING: Record<string, TokenPricing> = {
  // OpenAI o-series — reasoning_tokens cost more
  o3: { prompt: 0.01, completion: 0.04, reasoning: 0.04 },
  "o4-mini": { prompt: 0.0011, completion: 0.0044, reasoning: 0.0044 },
  o1: { prompt: 0.015, completion: 0.06, reasoning: 0.06 },
  "o1-mini": { prompt: 0.003, completion: 0.012, reasoning: 0.012 },
  "o1-preview": { prompt: 0.015, completion: 0.06, reasoning: 0.06 },
  "o3-mini": { prompt: 0.0011, completion: 0.0044, reasoning: 0.0044 },

  // Anthropic extended thinking — thinking blocks aren't tokenized
  // We estimate ~2.5 chars per token for thinking blocks
  "claude-3-5-sonnet-20241022": { prompt: 0.003, completion: 0.015, reasoning: 0.015 },
  "claude-3-5-haiku-20241022": { prompt: 0.0008, completion: 0.004, reasoning: 0.004 },
  "claude-3-opus-20240229": { prompt: 0.015, completion: 0.075, reasoning: 0.075 },

  // Standard models — no reasoning tokens (zero cost)
  "gpt-4o": { prompt: 0.0025, completion: 0.01, reasoning: 0 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006, reasoning: 0 },
  "gpt-4-turbo": { prompt: 0.01, completion: 0.03, reasoning: 0 },
  "gpt-3.5-turbo": { prompt: 0.0005, completion: 0.0015, reasoning: 0 },

  // Gemini thinking models
  "gemini-2.5-pro": { prompt: 0.00125, completion: 0.01, reasoning: 0.01 },
  "gemini-2.5-flash": { prompt: 0.00015, completion: 0.0006, reasoning: 0.0006 },
};

// ── Extract Thinking Tokens from Provider Responses ─────────────────────────

export interface ThinkingTokenBreakdown {
  promptTokens: number;
  completionTokens: number;
  thinkingTokens: number; // estimated reasoning/thinking tokens
  totalTokens: number;
  promptCost: number;
  completionCost: number;
  thinkingCost: number;
  totalCost: number;
  model: string;
  provider: "openai" | "anthropic" | "gemini" | "unknown";
  hasExtendedThinking: boolean;
}

/**
 * Extract thinking tokens from OpenAI response.
 *
 * OpenAI o-series returns `usage.completion_tokens_details.reasoning_tokens`
 * in the response. Standard models don't have this field.
 */
export function extractOpenAIThinkingTokens(response: any): {
  reasoningTokens: number;
  completionTokens: number;
} {
  const usage = response?.usage || {};
  const details = usage.completion_tokens_details || {};

  const reasoningTokens = details.reasoning_tokens || 0;
  const completionTokens = (usage.completion_tokens || 0) - reasoningTokens;

  return {
    reasoningTokens: Math.max(0, reasoningTokens),
    completionTokens: Math.max(0, completionTokens),
  };
}

/**
 * Estimate Anthropic extended thinking tokens.
 *
 * Anthropic's thinking blocks contain `thinking` text that ISN'T tokenized
 * in the usage response. We estimate tokens from character length.
 * Anthropic averages ~2.5 chars per token for English text.
 */
export function estimateAnthropicThinkingTokens(response: any): {
  thinkingTokens: number;
  completionTokens: number;
} {
  const content = response?.content || [];
  let thinkingCharCount = 0;
  let completionTokens = response?.usage?.output_tokens || 0;

  for (const block of content) {
    if (block.type === "thinking" && typeof block.thinking === "string") {
      thinkingCharCount += block.thinking.length;
    }
  }

  const CHARS_PER_TOKEN = 2.5;
  const thinkingTokens = Math.round(thinkingCharCount / CHARS_PER_TOKEN);
  completionTokens = Math.max(0, completionTokens - thinkingTokens);

  return {
    thinkingTokens,
    completionTokens,
  };
}

/**
 * Extract Gemini thinking tokens.
 *
 * Gemini 2.0+ returns reasoning tokens in `usageMetadata.candidatesTokenDetails`
 * under candidateType === "REASONING".
 */
export function extractGeminiThinkingTokens(response: any): {
  reasoningTokens: number;
  completionTokens: number;
} {
  const usage = response?.usageMetadata || {};
  const candidatesTokenDetails = usage.candidatesTokenDetails || [];

  let reasoningTokens = 0;
  for (const detail of candidatesTokenDetails) {
    if (detail.candidateType === "REASONING" || detail.candidate_type === "REASONING") {
      reasoningTokens += detail.tokenCount || detail.token_count || 0;
    }
  }

  // Fallback: Check if response has parts containing thought text
  if (reasoningTokens === 0) {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    let thoughtCharCount = 0;
    for (const part of parts) {
      if (part.thought === true || part.thoughtText || part.thought_text) {
        thoughtCharCount += (part.text || part.thoughtText || part.thought_text || "").length;
      }
    }
    if (thoughtCharCount > 0) {
      const CHARS_PER_TOKEN = 2.5;
      reasoningTokens = Math.round(thoughtCharCount / CHARS_PER_TOKEN);
    }
  }

  const totalCompletion = usage.candidatesTokenCount || usage.candidates_token_count || 0;
  const completionTokens = Math.max(0, totalCompletion - reasoningTokens);

  return {
    reasoningTokens: Math.max(0, reasoningTokens),
    completionTokens,
  };
}

/**
 * Provider-aware dispatcher: routes a raw provider response to the right
 * thinking-token extractor based on the model name. Returns zeros for
 * unrecognized models so callers can fall back to usage-based extraction.
 */
export function extractThinkingTokensFromResponse(
  model: string,
  response: unknown,
): { reasoningTokens: number; completionTokens: number } {
  if (!response || typeof response !== "object") {
    return { reasoningTokens: 0, completionTokens: 0 };
  }
  const m = (model ?? "").toLowerCase();
  if (m.includes("claude")) {
    const a = estimateAnthropicThinkingTokens(response);
    return { reasoningTokens: a.thinkingTokens, completionTokens: a.completionTokens };
  }
  if (m.includes("gemini")) return extractGeminiThinkingTokens(response);
  if (m.includes("gpt") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4")) {
    return extractOpenAIThinkingTokens(response);
  }
  return { reasoningTokens: 0, completionTokens: 0 };
}

/**
 * Secondary "response timing signature" estimator (Patent NHCE/DEV/2026/002).
 *
 * When a provider does NOT expose reasoning tokens explicitly (or exposes them
 * unreliably), unusually high wall-clock latency relative to the number of
 * visible output tokens is a strong signal of hidden thinking tokens. We model
 * an expected visible-output throughput (tokens/sec) and attribute the "excess"
 * generation time to reasoning tokens produced at the same throughput.
 *
 * This is a heuristic fallback — used only when explicit reasoning-token counts
 * are unavailable — and is intentionally conservative (returns 0 unless the
 * latency clearly exceeds what the visible tokens can explain).
 */
export function estimateThinkingTokensFromLatency(params: {
  latencyMs: number;
  visibleCompletionTokens: number;
  baselineTokensPerSec?: number;
  /** Minimum excess ms before we attribute any hidden reasoning (noise floor). */
  minExcessMs?: number;
}): number {
  const { latencyMs, visibleCompletionTokens } = params;
  const tps = params.baselineTokensPerSec ?? 40;
  const minExcessMs = params.minExcessMs ?? 750;
  if (latencyMs <= 0 || tps <= 0) return 0;

  const expectedMs = (Math.max(0, visibleCompletionTokens) / tps) * 1000;
  const excessMs = latencyMs - expectedMs;
  if (excessMs <= minExcessMs) return 0;

  return Math.round((excessMs / 1000) * tps);
}

// ── Cost Calculation ───────────────────────────────────────────────────────

export function calculateThinkingCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  thinkingTokens: number,
): ThinkingTokenBreakdown {
  const pricing = THINKING_MODEL_PRICING[model] || {
    prompt: 0.0005,
    completion: 0.0015,
    reasoning: 0,
  };

  const promptCost = (promptTokens / 1000) * pricing.prompt;
  const completionCost = (completionTokens / 1000) * pricing.completion;
  const thinkingCost = (thinkingTokens / 1000) * pricing.reasoning;

  return {
    promptTokens,
    completionTokens,
    thinkingTokens,
    totalTokens: promptTokens + completionTokens + thinkingTokens,
    promptCost: roundUSD(promptCost),
    completionCost: roundUSD(completionCost),
    thinkingCost: roundUSD(thinkingCost),
    totalCost: roundUSD(promptCost + completionCost + thinkingCost),
    model,
    provider: detectProvider(model),
    hasExtendedThinking: thinkingTokens > 0,
  };
}

/**
 * Record a gateway audit with full thinking-token breakdown.
 *
 * Call this instead of the standard recordGatewayAudit when you have
 * access to the raw provider response with thinking token data.
 */
export async function recordThinkingAudit(
  userId: number,
  breakdown: ThinkingTokenBreakdown,
  metadata?: { requestId?: string; latencyMs?: number },
): Promise<void> {
  try {
    const costEntry = {
      userId,
      model: breakdown.model,
      promptTokens: breakdown.promptTokens,
      completionTokens: breakdown.completionTokens,
      thinkingTokens: breakdown.thinkingTokens,
      totalTokens: breakdown.totalTokens,
      costUSD: breakdown.totalCost,
      date: new Date(),
    };

    await (db.recordTokenUsage as any)(
      costEntry.userId,
      costEntry.model,
      costEntry.promptTokens,
      costEntry.completionTokens,
      costEntry.thinkingTokens,
      costEntry.costUSD,
    );

    logger.info(
      {
        userId,
        model: breakdown.model,
        thinkingTokens: breakdown.thinkingTokens,
        thinkingCost: breakdown.thinkingCost,
        totalCost: breakdown.totalCost,
      },
      "[ThinkingTokens] Recorded breakdown",
    );
  } catch (err) {
    logger.error({ err, userId }, "[ThinkingTokens] Failed to record breakdown");
  }
}

/**
 * Get thinking-token analytics for a user over a time period.
 *
 * Returns: total cost, thinking cost, % spent on thinking, per-model breakdown.
 */
export async function getThinkingTokenAnalytics(
  userId: number,
  days: number = 30,
): Promise<{
  totalCost: number;
  totalThinkingCost: number;
  thinkingPercentage: number;
  totalThinkingTokens: number;
  perModel: Array<{
    model: string;
    totalCost: number;
    thinkingCost: number;
    thinkingTokens: number;
    thinkingPercentage: number;
  }>;
}> {
  try {
    const usage = await db.getTokenUsageByUserId(userId, days);
    const analytics = calculateThinkingAnalytics(usage);
    return analytics;
  } catch (err) {
    logger.error({ err, userId }, "[ThinkingTokens] Analytics failed");
    return {
      totalCost: 0,
      totalThinkingCost: 0,
      thinkingPercentage: 0,
      totalThinkingTokens: 0,
      perModel: [],
    };
  }
}

// ── Analytics Calculator ───────────────────────────────────────────────────

interface UsageRow {
  model: string;
  promptTokens: number;
  completionTokens: number;
  thinkingTokens?: number;
  totalTokens: number;
  costUSD: string | null;
}

function calculateThinkingAnalytics(usage: UsageRow[]): {
  totalCost: number;
  totalThinkingCost: number;
  thinkingPercentage: number;
  totalThinkingTokens: number;
  perModel: Array<{
    model: string;
    totalCost: number;
    thinkingCost: number;
    thinkingTokens: number;
    thinkingPercentage: number;
  }>;
} {
  const perModelMap = new Map<
    string,
    {
      totalCost: number;
      thinkingCost: number;
      thinkingTokens: number;
    }
  >();

  let totalCost = 0;
  let totalThinkingCost = 0;
  let totalThinkingTokens = 0;

  for (const row of usage) {
    const cost = parseFloat(row.costUSD || "0");
    const thinkingTokens = row.thinkingTokens || 0;
    const modelName = row.model || "unknown";

    // Estimate thinking cost based on model pricing
    const pricing = THINKING_MODEL_PRICING[modelName];
    let thinkingCost = 0;
    if (pricing && thinkingTokens > 0) {
      thinkingCost = (thinkingTokens / 1000) * pricing.reasoning;
    }

    totalCost += cost;
    totalThinkingCost += thinkingCost;
    totalThinkingTokens += thinkingTokens;

    const existing = perModelMap.get(modelName) || {
      totalCost: 0,
      thinkingCost: 0,
      thinkingTokens: 0,
    };
    existing.totalCost += cost;
    existing.thinkingCost += thinkingCost;
    existing.thinkingTokens += thinkingTokens;
    perModelMap.set(modelName, existing);
  }

  const perModel = Array.from(perModelMap.entries())
    .map(([model, data]) => ({
      model,
      totalCost: roundUSD(data.totalCost),
      thinkingCost: roundUSD(data.thinkingCost),
      thinkingTokens: data.thinkingTokens,
      thinkingPercentage:
        data.totalCost > 0 ? Math.round((data.thinkingCost / data.totalCost) * 100) : 0,
    }))
    .filter((m) => m.thinkingTokens > 0)
    .sort((a, b) => b.thinkingCost - a.thinkingCost);

  return {
    totalCost: roundUSD(totalCost),
    totalThinkingCost: roundUSD(totalThinkingCost),
    thinkingPercentage: totalCost > 0 ? Math.round((totalThinkingCost / totalCost) * 100) : 0,
    totalThinkingTokens,
    perModel,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function detectProvider(model: string): ThinkingTokenBreakdown["provider"] {
  const m = model.toLowerCase();
  if (m.includes("claude")) return "anthropic";
  if (m.includes("gemini")) return "gemini";
  if (m.includes("gpt") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4"))
    return "openai";
  return "unknown";
}

function roundUSD(amount: number): number {
  return Math.round(amount * 10000) / 10000;
}

// ── Detection cascade + receipt line items (DevPulse Patent NHCE/DEV/2026/002) ─
// Salvaged 2026-09-25 (Team D): the extractors above answer "how many"; the
// cascade below answers "how do we know" — direct provider field (exact),
// differential total−input−output (estimated), latency signature (estimated).
// The line item is the unit that lands on usage envelopes and signed receipts.

export type ReasoningDetectionMethod =
  | "direct" // provider-reported reasoning_tokens field — exact
  | "differential" // total − input − output residual — estimated
  | "timing_estimate" // latency signature heuristic — estimated
  | "none";

export type ReasoningConfidence = "exact" | "estimated" | "unknown";

export function reasoningConfidenceFor(
  method: ReasoningDetectionMethod,
): ReasoningConfidence {
  if (method === "direct") return "exact";
  if (method === "differential" || method === "timing_estimate") return "estimated";
  return "unknown";
}

/**
 * Differential detection: when the provider reports total/input/output but no
 * explicit reasoning field, a positive residual is hidden thinking tokens.
 * Returns 0 when the numbers reconcile (or are absent).
 */
export function differentialReasoningTokens(input: {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}): number {
  const total = Math.max(0, Math.floor(input.totalTokens ?? 0));
  const prompt = Math.max(0, Math.floor(input.inputTokens ?? 0));
  const output = Math.max(0, Math.floor(input.outputTokens ?? 0));
  if (total <= 0 || prompt <= 0 || output <= 0) return 0;
  return Math.max(0, total - prompt - output);
}

/**
 * Full cascade: direct field → differential → timing estimate → none.
 * Mirrors the DevPulse extraction order; the repo's provider-specific
 * extractors remain the preferred "direct" source for raw responses.
 */
export function detectReasoningTokens(input: {
  model: string;
  reportedReasoningTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}): { tokens: number; method: ReasoningDetectionMethod } {
  const reported = Math.max(0, Math.floor(input.reportedReasoningTokens ?? 0));
  if (reported > 0) return { tokens: reported, method: "direct" };

  const differential = differentialReasoningTokens(input);
  if (differential > 0) return { tokens: differential, method: "differential" };

  const output = Math.max(0, Math.floor(input.outputTokens ?? 0));
  const latencyMs = Math.max(0, input.latencyMs ?? 0);
  if (latencyMs > 0 && output > 0) {
    const estimated = estimateThinkingTokensFromLatency({
      latencyMs,
      visibleCompletionTokens: output,
    });
    if (estimated > 0) return { tokens: estimated, method: "timing_estimate" };
  }
  return { tokens: 0, method: "none" };
}

/**
 * Runaway-reasoning flag: thinking tokens above 3× visible output on a single
 * call is anomalous (DevPulse kill-switch threshold). Feed into the runaway
 * detector's thinking-anomaly trip.
 */
export function isReasoningAnomaly(reasoningTokens: number, outputTokens: number): boolean {
  if (outputTokens <= 0) return reasoningTokens > 0;
  return reasoningTokens > outputTokens * 3;
}

export interface ReasoningSpendLineItem {
  kind: "reasoning_spend";
  model: string;
  reasoningTokens: number;
  /** USD cost of the reasoning tokens, or null when no price was available. */
  costUsd: number | null;
  detectionMethod: ReasoningDetectionMethod;
  confidence: ReasoningConfidence;
  /** reasoning cost ÷ visible-output cost, or null when output cost is 0. */
  overheadMultiplier: number | null;
  isAnomaly: boolean;
  /**
   * Honesty note: reasoning tokens are already inside the provider's
   * completion/output count — this line item is a breakout, not new spend.
   */
  breakoutOfOutputTokens: true;
}

/**
 * Build the canonical reasoning-spend line item for usage envelopes and
 * signed receipt payloads. Returns null when no reasoning tokens detected.
 * Reasoning prices at the output rate (true for every major provider).
 */
export function buildReasoningSpendLineItem(input: {
  model: string;
  reportedReasoningTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  /** Output price per 1M tokens in USD; null/undefined → costUsd null. */
  outputPerMillionUsd?: number | null;
}): ReasoningSpendLineItem | null {
  const { tokens, method } = detectReasoningTokens(input);
  if (tokens <= 0) return null;
  const output = Math.max(0, Math.floor(input.outputTokens ?? 0));
  const rate = input.outputPerMillionUsd;
  const costUsd =
    rate != null && Number.isFinite(rate) && rate >= 0
      ? Math.round(((tokens / 1_000_000) * rate) * 1_000_000) / 1_000_000
      : null;
  const outputCostUsd =
    rate != null && Number.isFinite(rate) && rate > 0 && output > 0
      ? (output / 1_000_000) * rate
      : 0;
  return {
    kind: "reasoning_spend",
    model: input.model,
    reasoningTokens: tokens,
    costUsd,
    detectionMethod: method,
    confidence: reasoningConfidenceFor(method),
    overheadMultiplier:
      costUsd != null && outputCostUsd > 0
        ? Math.round((costUsd / outputCostUsd) * 100) / 100
        : null,
    isAnomaly: isReasoningAnomaly(tokens, output),
    breakoutOfOutputTokens: true,
  };
}
