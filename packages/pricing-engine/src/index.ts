/**
 * @rakshex/pricing-engine — typed surface only (foundation scaffold).
 *
 * TODO(product): implement versioned provider/model pricing tables and cost
 * calculation. Do not invent fake prices here.
 */

export interface PricingVersion {
  id: string;
  provider: string;
  model: string;
  /** ISO date when this version becomes effective. */
  effectiveFrom: string;
  currency: "USD";
  inputPer1M?: number;
  outputPer1M?: number;
  cachedInputPer1M?: number;
}

export interface TokenUsageInput {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface CostEstimate {
  /** Always labeled — callers must not present as confirmed provider bill. */
  kind: "estimate";
  currency: "USD";
  amount: number;
  pricingVersionId: string | null;
  notes: string[];
}

/**
 * Compile-safe adapter until real pricing tables land.
 * Returns a zero estimate with explicit TODO notes — never fake unit prices.
 */
export function estimateCost(_usage: TokenUsageInput): CostEstimate {
  return {
    kind: "estimate",
    currency: "USD",
    amount: 0,
    pricingVersionId: null,
    notes: [
      "TODO(product): pricing-engine has no pricing tables yet",
      "Do not treat amount as confirmed usage cost",
    ],
  };
}

export function listPricingVersions(): PricingVersion[] {
  // TODO(product): load from packages/database or config
  return [];
}
