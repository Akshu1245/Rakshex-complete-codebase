/**
 * Versioned model pricing catalog.
 * Historical rows are immutable — new prices get a new version id + effectiveFrom.
 * Amounts are USD per 1M tokens unless noted.
 */

export type CostKind = "exact" | "estimate";

export interface PricingVersion {
  id: string;
  provider: string;
  model: string;
  /** ISO date (YYYY-MM-DD) when this version becomes effective. */
  effectiveFrom: string;
  /** Exclusive end date; null = still current */
  effectiveTo: string | null;
  currency: "USD";
  region?: string;
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  reasoningPer1M?: number;
  toolCallPer1K?: number;
  searchPer1K?: number;
  batchDiscount?: number;
  fineTunePer1M?: number;
  enterpriseOverride?: boolean;
}

/** Seed catalog — real public list prices as of early 2025/2026 style estimates. */
export const PRICING_CATALOG: PricingVersion[] = [
  {
    id: "pv_openai_gpt4o_mini_2024_07",
    provider: "openai",
    model: "gpt-4o-mini",
    effectiveFrom: "2024-07-18",
    effectiveTo: null,
    currency: "USD",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    cachedInputPer1M: 0.075,
  },
  {
    id: "pv_openai_gpt4o_2024_05",
    provider: "openai",
    model: "gpt-4o",
    effectiveFrom: "2024-05-13",
    effectiveTo: null,
    currency: "USD",
    inputPer1M: 2.5,
    outputPer1M: 10,
    cachedInputPer1M: 1.25,
  },
  {
    id: "pv_anthropic_sonnet_2024_10",
    provider: "anthropic",
    model: "claude-sonnet-4",
    effectiveFrom: "2024-10-01",
    effectiveTo: null,
    currency: "USD",
    inputPer1M: 3,
    outputPer1M: 15,
    cachedInputPer1M: 0.3,
  },
  {
    id: "pv_anthropic_haiku_2024_10",
    provider: "anthropic",
    model: "claude-haiku-3.5",
    effectiveFrom: "2024-10-01",
    effectiveTo: null,
    currency: "USD",
    inputPer1M: 0.8,
    outputPer1M: 4,
  },
  {
    id: "pv_gemini_flash_2024_12",
    provider: "gemini",
    model: "gemini-2.0-flash",
    effectiveFrom: "2024-12-01",
    effectiveTo: null,
    currency: "USD",
    inputPer1M: 0.1,
    outputPer1M: 0.4,
  },
  {
    id: "pv_azure_gpt4o_2024_05",
    provider: "azure_openai",
    model: "gpt-4o",
    effectiveFrom: "2024-05-13",
    effectiveTo: null,
    currency: "USD",
    region: "eastus",
    inputPer1M: 2.5,
    outputPer1M: 10,
  },
  {
    id: "pv_bedrock_claude_sonnet_2024_10",
    provider: "bedrock",
    model: "anthropic.claude-sonnet-4",
    effectiveFrom: "2024-10-01",
    effectiveTo: null,
    currency: "USD",
    region: "us-east-1",
    inputPer1M: 3,
    outputPer1M: 15,
  },
  {
    id: "pv_openrouter_default_2025_01",
    provider: "openrouter",
    model: "*",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    currency: "USD",
    inputPer1M: 1,
    outputPer1M: 3,
  },
  // Historical example: older GPT-4o rate (immutable history)
  {
    id: "pv_openai_gpt4o_2024_05_legacy",
    provider: "openai",
    model: "gpt-4o",
    effectiveFrom: "2024-05-13",
    effectiveTo: "2024-08-01",
    currency: "USD",
    inputPer1M: 5,
    outputPer1M: 15,
  },
];

/** FX rates to USD (static snapshot for conversion). */
export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
  JPY: 0.0067,
};
