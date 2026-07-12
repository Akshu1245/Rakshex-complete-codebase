/**
 * OpenRouter provider — OpenAI-compatible API that gives access to
 * 200+ models including free-tier DeepSeek, Llama, Gemma, and Mistral.
 *
 * Base URL: https://openrouter.ai/api/v1/chat/completions
 * Required headers: Authorization, HTTP-Referer, X-Title
 *
 * Free models (cost = $0):
 *   deepseek/deepseek-chat-v3-0324:free  ← default
 *   meta-llama/llama-3.3-70b-instruct:free
 *   google/gemma-3-27b-it:free
 *   mistralai/mistral-7b-instruct:free
 *   deepseek/deepseek-r1:free
 */

import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { ExternalServiceError, RuntimePolicyError } from "../_core/errors";
import { logger } from "../_core/logger";
import type { InvokeParams, InvokeResult, Message, ToolCall, Tool } from "../_core/llm";
import type { LLMProvider, ProviderInvokeOptions } from "../_core/providers";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = "https://rakshex.in";
const SITE_TITLE = "Rakshex";

export const FREE_MODELS = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "deepseek/deepseek-r1:free",
] as const;

const DEFAULT_MODEL = "deepseek/deepseek-chat-v3-0324:free";

/** All free models have $0 cost per token */
const FREE_COST = { prompt: 0, completion: 0 };

/* ─── Message format translation ────────────────────────────────────────── */

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: "text"; text: string }>;
  tool_call_id?: string;
  name?: string;
}

function toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
  return messages.map((msg) => {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? (msg.content as Array<{ type: "text"; text: string }>)
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n")
          : String(msg.content);

    if (msg.role === "tool") {
      return {
        role: "tool" as const,
        content,
        tool_call_id: msg.tool_call_id ?? "unknown",
      };
    }

    return {
      role: msg.role as "system" | "user" | "assistant",
      content,
    };
  });
}

/* ─── Tool translation ──────────────────────────────────────────────────── */

function toOpenAITools(tools?: Tool[]):
  | Array<{
      type: "function";
      function: { name: string; description?: string; parameters?: unknown };
    }>
  | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters ?? { type: "object", properties: {} },
    },
  }));
}

/* ─── Main invocation ───────────────────────────────────────────────────── */

export async function invokeOpenRouter(
  params: InvokeParams,
  apiKey: string,
  options: ProviderInvokeOptions = {},
): Promise<InvokeResult> {
  if (options.killSwitchActive) {
    throw new RuntimePolicyError("LLM API request blocked by Rakshex Kill Switch.", {
      context: { policy: "kill_switch" },
    });
  }

  const model = options.model ?? process.env.OPENROUTER_DEFAULT_MODEL ?? DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages: toOpenAIMessages(params.messages),
    max_tokens: params.maxTokens ?? params.max_tokens ?? 4096,
  };

  const openaiTools = toOpenAITools(params.tools);
  if (openaiTools && openaiTools.length > 0) {
    body.tools = openaiTools;
  }

  const toolChoice = params.toolChoice ?? params.tool_choice;
  if (toolChoice) {
    if (toolChoice === "auto" || toolChoice === "none") {
      body.tool_choice = toolChoice;
    } else if (toolChoice === "required") {
      body.tool_choice = "required";
    } else if (typeof toolChoice === "object" && "function" in toolChoice) {
      body.tool_choice = { type: "function", function: { name: toolChoice.function.name } };
    }
  }

  const response = await fetchWithTimeout(OPENROUTER_BASE_URL, {
    method: "POST",
    timeoutMs: 120_000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": REFERER,
      "X-Title": SITE_TITLE,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ExternalServiceError(
      `OpenRouter invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request via OpenRouter failed. Please try again.",
        context: {
          provider: "openrouter",
          model,
          status: response.status,
          body: errorText.slice(0, 500),
        },
      },
    );
  }

  const raw = (await response.json()) as {
    id: string;
    model: string;
    choices: Array<{
      index: number;
      message: {
        role: string;
        content: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
      finish_reason: string | null;
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  const choice = raw.choices[0];

  const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    type: "function" as const,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  }));

  const result: InvokeResult = {
    id: raw.id,
    created: Math.floor(Date.now() / 1000),
    model: raw.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: choice.message.content ?? "",
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: choice.finish_reason ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: raw.usage.prompt_tokens,
      completion_tokens: raw.usage.completion_tokens,
      total_tokens: raw.usage.total_tokens,
    },
  };

  // Record token usage (free models cost $0)
  if (options.userId && result.usage) {
    const isFree = FREE_MODELS.includes(model as (typeof FREE_MODELS)[number]);
    const pricing = isFree ? FREE_COST : { prompt: 1.0, completion: 2.0 };
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
        logger.warn({ err }, "[OpenRouter] Failed to record token usage");
      }
    });
  }

  return result;
}

/* ─── LLMProvider conformance ───────────────────────────────────────────── */

export const openrouterProvider: LLMProvider = {
  name: "openrouter",
  defaultModel: DEFAULT_MODEL,

  async invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError("OpenRouter API key not configured.", {
        safeMessage: "OpenRouter is not configured. Please add OPENROUTER_API_KEY.",
      });
    }
    return invokeOpenRouter(params, apiKey, options);
  },

  supportsModel: (model: string) =>
    FREE_MODELS.includes(model as (typeof FREE_MODELS)[number]) || model.includes("/"),

  supportsVision: () => false,
  supportsPromptCaching: () => false,
};
