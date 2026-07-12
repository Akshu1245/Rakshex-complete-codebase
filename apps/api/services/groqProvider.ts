/**
 * Groq provider adapter — ultra-fast inference via Groq Cloud.
 *
 * Supports:
 *   - Llama 3.1 / 3.2 (8B, 70B, 405B)
 *   - Mixtral 8x7B, 8x22B
 *   - Gemma 2
 *   - Whisper (speech-to-text, out of scope for chat)
 *
 * Auth: reads GROQ_API_KEY from environment.
 */

import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { ExternalServiceError } from "../_core/errors";
import { logger } from "../_core/logger";
import type { InvokeParams, InvokeResult } from "../_core/llm";
import type { LLMProvider, ProviderInvokeOptions } from "../_core/providers";

/* ─── Pricing (per 1M tokens, USD) ─────────────────────────────────────── */

const GROQ_PRICING: Record<string, { prompt: number; completion: number }> = {
  "llama-3.1-405b": { prompt: 0.59, completion: 0.79 },
  "llama-3.1-70b": { prompt: 0.59, completion: 0.79 },
  "llama-3.1-8b": { prompt: 0.05, completion: 0.08 },
  "llama-3.2-1b": { prompt: 0.04, completion: 0.04 },
  "llama-3.2-3b": { prompt: 0.06, completion: 0.06 },
  "llama-3.2-11b": { prompt: 0.18, completion: 0.18 },
  "llama-3.2-90b": { prompt: 0.9, completion: 0.9 },
  "mixtral-8x22b": { prompt: 0.65, completion: 0.65 },
  "mixtral-8x7b": { prompt: 0.24, completion: 0.24 },
  "gemma-2-9b": { prompt: 0.2, completion: 0.2 },
  "gemma-2-27b": { prompt: 0.27, completion: 0.27 },
};

function resolvePricing(model: string): { prompt: number; completion: number } {
  for (const [prefix, price] of Object.entries(GROQ_PRICING)) {
    if (model.toLowerCase().includes(prefix)) return price;
  }
  return { prompt: 0.59, completion: 0.79 };
}

async function invokeGroq(
  params: InvokeParams,
  apiKey: string,
  options: ProviderInvokeOptions = {},
): Promise<InvokeResult> {
  const model = options.model ?? "llama-3.1-70b-versatile";

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

  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
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
      `Groq invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request via Groq failed. Please try again.",
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
        logger.warn({ err }, "[Groq] Failed to record token usage");
      }
    });
  }

  return result;
}

export const groqProvider: LLMProvider = {
  name: "groq",
  defaultModel: "llama-3.1-70b-versatile",

  async invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError("Groq API key not configured.", {
        safeMessage: "Groq AI is not configured.",
      });
    }
    return invokeGroq(params, apiKey, options);
  },

  supportsModel: (model: string) =>
    model.toLowerCase().startsWith("llama-") ||
    model.toLowerCase().startsWith("mixtral-") ||
    model.toLowerCase().startsWith("gemma-"),

  supportsVision: () => false,
  supportsPromptCaching: () => false,
};
