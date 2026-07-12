export type { CostKind, PricingVersion } from "./catalog.js";
export { PRICING_CATALOG, FX_TO_USD } from "./catalog.js";
export type { TokenUsageInput, CostRecord, OptimizationHint } from "./calculate.js";
export {
  calculateCost,
  resolvePricingVersion,
  labelExactCost,
  listPricingVersions,
  forecastSpend,
  recommendOptimizations,
} from "./calculate.js";

import { calculateCost } from "./calculate.js";

/** @deprecated use calculateCost — kept for scaffold compatibility */
export function estimateCost(usage: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}) {
  return calculateCost(usage);
}
