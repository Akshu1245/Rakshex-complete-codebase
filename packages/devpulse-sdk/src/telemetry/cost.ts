/**
 * DevPulse SDK — Per-Model Cost Calculator
 *
 * Pricing as of May 2026. Update this table as models change.
 * All prices in USD per 1,000 tokens (input/output).
 */

interface ModelPrice {
  inputPricePer1k: number;
  outputPricePer1k: number;
  cachedInputPricePer1k?: number;
}

type PriceTable = Record<string, ModelPrice>;

const PRICES: PriceTable = {
  // OpenAI
  "gpt-4o": { inputPricePer1k: 0.0025, outputPricePer1k: 0.01, cachedInputPricePer1k: 0.00125 },
  "gpt-4o-mini": { inputPricePer1k: 0.00015, outputPricePer1k: 0.0006, cachedInputPricePer1k: 0.000075 },
  "gpt-4-turbo": { inputPricePer1k: 0.01, outputPricePer1k: 0.03 },
  "gpt-4": { inputPricePer1k: 0.03, outputPricePer1k: 0.06 },
  "gpt-3.5-turbo": { inputPricePer1k: 0.0005, outputPricePer1k: 0.0015 },
  "o1": { inputPricePer1k: 0.015, outputPricePer1k: 0.06 },
  "o1-mini": { inputPricePer1k: 0.003, outputPricePer1k: 0.012 },
  "o3-mini": { inputPricePer1k: 0.0011, outputPricePer1k: 0.0044 },

  // Anthropic
  "claude-sonnet-4-20250514": { inputPricePer1k: 0.003, outputPricePer1k: 0.015, cachedInputPricePer1k: 0.0003 },
  "claude-3-5-sonnet-20241022": { inputPricePer1k: 0.003, outputPricePer1k: 0.015, cachedInputPricePer1k: 0.0003 },
  "claude-3-5-haiku-20241022": { inputPricePer1k: 0.001, outputPricePer1k: 0.005, cachedInputPricePer1k: 0.0001 },
  "claude-3-opus-20240229": { inputPricePer1k: 0.015, outputPricePer1k: 0.075 },
  "claude-3-haiku-20240307": { inputPricePer1k: 0.00025, outputPricePer1k: 0.00125 },

  // Groq
  "llama-3.3-70b-versatile": { inputPricePer1k: 0.00059, outputPricePer1k: 0.00079 },
  "llama-3.1-8b-instant": { inputPricePer1k: 0.00005, outputPricePer1k: 0.00008 },
  "mixtral-8x7b-32768": { inputPricePer1k: 0.00027, outputPricePer1k: 0.00027 },

  // Mistral
  "mistral-large-latest": { inputPricePer1k: 0.002, outputPricePer1k: 0.006 },
  "mistral-small-latest": { inputPricePer1k: 0.001, outputPricePer1k: 0.003 },

  // DeepSeek
  "deepseek-chat": { inputPricePer1k: 0.00014, outputPricePer1k: 0.00028 },
  "deepseek-reasoner": { inputPricePer1k: 0.00055, outputPricePer1k: 0.00219 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0,
): { costUsd: number; priceMatched: boolean } {
  // Find exact match first
  let price = PRICES[model];

  // Fuzzy match — try prefix matching
  if (!price) {
    for (const [key, val] of Object.entries(PRICES)) {
      if (model.startsWith(key) || key.startsWith(model)) {
        price = val;
        break;
      }
    }
  }

  // Fallback for common prefixes
  if (!price) {
    if (model.startsWith("gpt-4")) price = PRICES["gpt-4o"] || { inputPricePer1k: 0.003, outputPricePer1k: 0.015 };
    else if (model.startsWith("gpt-3.5")) price = PRICES["gpt-3.5-turbo"]!;
    else if (model.startsWith("claude-3")) price = PRICES["claude-3-5-sonnet-20241022"]!;
    else if (model.startsWith("claude")) price = { inputPricePer1k: 0.003, outputPricePer1k: 0.015 };
    else if (model.startsWith("llama")) price = { inputPricePer1k: 0.0005, outputPricePer1k: 0.001 };
    else if (model.startsWith("mixtral")) price = { inputPricePer1k: 0.0005, outputPricePer1k: 0.001 };
    else price = { inputPricePer1k: 0.001, outputPricePer1k: 0.005 }; // unknown, assume mid-range
  }

  const cachedCost = (cachedInputTokens / 1000) * (price.cachedInputPricePer1k || price.inputPricePer1k * 0.5);
  const inputCost = ((inputTokens - cachedInputTokens) / 1000) * price.inputPricePer1k;
  const outputCost = (outputTokens / 1000) * price.outputPricePer1k;
  const total = Math.max(0, cachedCost + inputCost + outputCost);

  return {
    costUsd: Math.round(total * 1_000_000) / 1_000_000, // 6 decimal places
    priceMatched: !!PRICES[model],
  };
}
