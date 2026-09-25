/**
 * Worst-case cost estimation for the pre-request gate.
 *
 * The honest comment, stated plainly: the gate runs BEFORE the model call,
 * so it cannot know the output token count. The only safe pre-request number
 * is the worst case: input tokens at the input rate PLUS maxTokens at the
 * output rate. That is a bound, not a prediction — actual cost always comes
 * in at or below it (barring provider-side surprises like retries, which the
 * reservation layer accounts for separately). A ceiling DENY on a worst-case
 * estimate can therefore block a call that would have been cheap; that is the
 * price of a real ceiling, and it is documented in the DENY reason.
 *
 * Token counting: the repo has no tokenizer dependency (no tiktoken /
 * gpt-tokenizer in any package.json), and adding one means a SkillSpector
 * scan plus a native/wasm weight the gate hot path should not carry. The
 * heuristic ceil(chars/4) overcounts for most Latin text, which is the safe
 * direction for a worst-case bound — and it is labeled ESTIMATED.
 */
import { asSignalLabel, withSignalLabel, type SignalLabel } from "./labels";
import { lookupModelPrice, PRICE_TABLE_VERSION } from "./priceTable";

export interface WorstCaseEstimateInput {
  provider: string;
  model: string;
  /** Measured or heuristically counted input tokens. */
  inputTokens: number;
  /** Max output tokens the caller allows — the output bound, not a prediction. */
  maxTokens: number;
}

export interface WorstCaseCostEstimate {
  costUsd: number;
  inputTokens: number;
  /** Always the caller's maxTokens: the bound used, never a predicted count. */
  outputTokens: number;
  signalLabel: SignalLabel;
  priceTableVersion: string;
}

function assertNonNegativeInt(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${name} must be a non-negative integer, got ${value}`);
  }
}

/**
 * Worst-case cost = input*inputRate + maxTokens*outputRate.
 * Throws on an unknown model — the caller must treat that as un-estimable
 * and DENY fail-closed, never guess a rate.
 */
export function estimateWorstCaseCost(input: WorstCaseEstimateInput): WorstCaseCostEstimate {
  assertNonNegativeInt("inputTokens", input.inputTokens);
  assertNonNegativeInt("maxTokens", input.maxTokens);
  const price = lookupModelPrice(input.provider, input.model);
  if (!price) {
    throw new Error(
      `No price entry for ${input.provider}/${input.model}: cost is unknown, do not guess — DENY fail-closed`,
    );
  }
  const costUsd =
    (input.inputTokens / 1_000_000) * price.inputPerMillionUsd +
    (input.maxTokens / 1_000_000) * price.outputPerMillionUsd;
  return {
    costUsd,
    inputTokens: input.inputTokens,
    outputTokens: input.maxTokens,
    signalLabel: price.signalLabel,
    priceTableVersion: PRICE_TABLE_VERSION,
  };
}

/** Heuristic input-token count: ceil(chars/4). Labeled ESTIMATED, always. */
export function estimateInputTokensHeuristic(text: string): { tokens: number; signalLabel: SignalLabel } {
  return withSignalLabel({ tokens: Math.max(1, Math.ceil(text.length / 4)) }, "estimated");
}

/** Re-label an estimate with the label of a token count that fed it. */
export function relabelEstimate(
  estimate: WorstCaseCostEstimate,
  signalLabel: unknown,
): WorstCaseCostEstimate {
  const label = asSignalLabel(signalLabel);
  // Never upgrade a price-table estimate to "exact": the table is estimated by contract.
  return { ...estimate, signalLabel: label === "exact" ? "estimated" : label };
}
