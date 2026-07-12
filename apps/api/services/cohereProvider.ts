/**
 * Cohere provider adapter — calls the Cohere Chat API.
 *
 * Supports:
 *   - Command R, Command R+, Command R7B
 *   - Aya (multilingual)
 *
 * Auth: reads COHERE_API_KEY from environment.
 */

import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { ExternalServiceError } from "../_core/errors";
import { logger } from "../_core/logger";
import type { InvokeParams, InvokeResult, Message } from "../_core/llm";
import type { LLMProvider, ProviderInvokeOptions } from "../_core/providers";

/* ─── Pricing (per 1M tokens, USD) ─────────────────────────────────────── */

const COHERE_PRICING: Record<string, { prompt: number; completion: number }> = {
  "command-r": { prompt: 0.15, completion: 0.6 },
  "command-r-plus": { prompt: 2.5, completion: 10.0 },
  "command-r7b": { prompt: 0.0375, completion: 0.15 },
  aya: { prompt: 0.5, completion: 1.5 },
};

function resolvePricing(model: string): { prompt: number; completion: number } {
  for (const [prefix, price] of Object.entries(COHERE_PRICING)) {
    if (model.toLowerCase().includes(prefix)) return price;
  }
  return { prompt: 0.15, completion: 0.6 };
}

interface CohereMessage {
  role: "USER" | "CHATBOT" | "SYSTEM";
  message: string;
}

function toCohereMessages(messages: Message[]): CohereMessage[] {
  return messages.map((m) => ({
    role: m.role === "user" ? "USER" : m.role === "assistant" ? "CHATBOT" : "SYSTEM",
    message: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
}

async function invokeCohere(
  params: InvokeParams,
  apiKey: string,
  options: ProviderInvokeOptions = {},
): Promise<InvokeResult> {
  const model = options.model ?? "command-r";
  const messages = toCohereMessages(params.messages);
  const systemMessage = messages.find((m) => m.role === "SYSTEM")?.message;
  const chatHistory = messages.filter((m) => m.role !== "SYSTEM");

  const body: Record<string, unknown> = {
    model,
    message: chatHistory[chatHistory.length - 1]?.message ?? "",
    chat_history: chatHistory.slice(0, -1),
    max_tokens: params.maxTokens ?? 4096,
    temperature: 0.3,
  };

  if (systemMessage) {
    body.preamble = systemMessage;
  }

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      parameter_definitions: t.function.parameters,
    }));
  }

  const response = await fetchWithTimeout("https://api.cohere.com/v1/chat", {
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
      `Cohere invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request via Cohere failed. Please try again.",
        context: { model, status: response.status, body: errorText.slice(0, 500) },
      },
    );
  }

  const raw = (await response.json()) as {
    text: string;
    meta?: { tokens?: { input_tokens?: number; output_tokens?: number } };
    tool_calls?: Array<{ name: string; parameters: Record<string, unknown> }>;
  };

  const promptTokens = raw.meta?.tokens?.input_tokens ?? 0;
  const completionTokens = raw.meta?.tokens?.output_tokens ?? 0;

  const result: InvokeResult = {
    id: `cohere-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: raw.text ?? "",
          tool_calls: raw.tool_calls?.map((tc, i) => ({
            id: `call_${i}`,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.parameters) },
          })),
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };

  if (options.userId && result.usage) {
    const pricing = resolvePricing(model);
    const cost =
      (promptTokens / 1_000_000) * pricing.prompt +
      (completionTokens / 1_000_000) * pricing.completion;

    import("../db").then(async (db) => {
      try {
        await db.recordTokenUsage(options.userId!, model, promptTokens, completionTokens, 0, cost);
      } catch (err) {
        logger.warn({ err }, "[Cohere] Failed to record token usage");
      }
    });
  }

  return result;
}

export const cohereProvider: LLMProvider = {
  name: "cohere",
  defaultModel: "command-r",

  async invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult> {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError("Cohere API key not configured.", {
        safeMessage: "Cohere AI is not configured.",
      });
    }
    return invokeCohere(params, apiKey, options);
  },

  supportsModel: (model: string) =>
    model.toLowerCase().startsWith("command-") || model.toLowerCase().startsWith("aya"),

  supportsVision: () => false,
  supportsPromptCaching: () => false,
};
