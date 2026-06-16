/**
 * Mistral AI provider adapter — calls the Mistral Chat Completion API.
 *
 * Supports:
 *   - Mistral Large, Mistral Medium, Mistral Small
 *   - Codestral, Mathstral
 *   - Pixtral (vision)
 *
 * Auth: reads MISTRAL_API_KEY from environment.
 */

import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { ExternalServiceError } from "../_core/errors";
import { logger } from "../_core/logger";
import type { InvokeParams, InvokeResult, Message } from "../_core/llm";
import type { LLMProvider, ProviderInvokeOptions } from "../_core/providers";

/* ─── Pricing (per 1M tokens, USD) ─────────────────────────────────────── */

const MISTRAL_PRICING: Record<string, { prompt: number; completion: number }> = {
  "mistral-large": { prompt: 2.0, completion: 6.0 },
  "mistral-medium": { prompt: 0.6, completion: 1.8 },
  "mistral-small": { prompt: 0.2, completion: 0.6 },
  codestral: { prompt: 0.2, completion: 0.6 },
  pixtral: { prompt: 0.15, completion: 0.6 },
};

function resolvePricing(model: string): { prompt: number; completion: number } {
  for (const [prefix, price] of Object.entries(MISTRAL_PRICING)) {
    if (model.toLowerCase().includes(prefix)) return price;
  }
  return { prompt: 0.2, completion: 0.6 };
}

async function invokeMistral(
  params: InvokeParams,
  apiKey: string,
  options: ProviderInvokeOptions = {},
): Promise<InvokeResult> {
  const model = options.model ?? "mistral-small-latest";

  const body: Record<string, unknown> = {
    model,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 4096,
    temperature: 0.3,
  };

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
    body.tool_choice = params.toolChoice ?? "auto";
  }

  const response = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    timeoutMs: 60_000,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ExternalServiceError(
      `Mistral invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request via Mistral failed. Please try again.",
        context: { model, status: response.status, body: errorText.slice(0, 500) },
      },
    );
  }

  const result = (await response.json()) as InvokeResult;

  if (options.userId && result.usage) {
    const pricing = resolvePricing(model);
    const cost =
      (result.usage.prompt_tokens / 1_000_000) * pricing.prompt +
      (result.usage.completion_tokens / 1_000_000) * pricing.completion;

    import("../db").then(async (db) => {
      try {
        await db.recordTokenUsage(
          options.userId!,
          model,
          result.usage!.prompt_tokens,
          result.usage!.completion_tokens,
          0,
          cost,
        );
      } catch (err) {
        logger.warn({ err }, "[Mistral] Failed to record token usage");
      }
    });
  }

  return result;
}

export const mistralProvider: LLMProvider = {
  name: "mistral",
  defaultModel: "mistral-small-latest",

  async invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError("Mistral API key not configured.", {
        safeMessage: "Mistral AI is not configured.",
      });
    }
    return invokeMistral(params, apiKey, options);
  },

  supportsModel: (model: string) =>
    model.toLowerCase().startsWith("mistral-") ||
    model.toLowerCase().startsWith("codestral") ||
    model.toLowerCase().startsWith("mathstral") ||
    model.toLowerCase().startsWith("pixtral"),

  supportsVision: () => true,
  supportsPromptCaching: () => false,
};
