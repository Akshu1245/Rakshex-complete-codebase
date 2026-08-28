/**
 * Anthropic API provider adapter — calls the Anthropic Messages API
 * directly, translating the gateway's canonical types. Supports:
 *   - Claude 3/3.5/4 (Opus, Sonnet, Haiku)
 *   - Vision (image content blocks via base64)
 *   - Prompt caching (cache_control on system + turn breaks)
 *   - Extended thinking (Claude 3.7+)
 */

import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { ExternalServiceError, RuntimePolicyError } from "../_core/errors";
import { logger } from "../_core/logger";
import { estimateAnthropicThinkingTokens } from "./thinkingTokens";
import type {
  InvokeParams,
  InvokeResult,
  Message,
  MessageContent,
  ToolCall,
  Tool,
  ResponseFormat,
  OutputSchema,
} from "../_core/llm";
import type { LLMProvider, ProviderInvokeOptions } from "../_core/providers";

/* ─── Pricing ──────────────────────────────────────────────────────────── */

const ANTHROPIC_PRICING: Record<string, { prompt: number; completion: number }> = {
  "claude-3-5-sonnet-20241022": { prompt: 3.0, completion: 15.0 },
  "claude-3-5-haiku-20241022": { prompt: 0.8, completion: 4.0 },
  "claude-3-opus-20240229": { prompt: 15.0, completion: 75.0 },
  "claude-3-sonnet-20240229": { prompt: 3.0, completion: 15.0 },
  "claude-3-haiku-20240307": { prompt: 0.25, completion: 1.25 },
  "claude-3-7-sonnet-20250219": { prompt: 3.0, completion: 15.0 },
};

/* ─── Message format translation ───────────────────────────────────────── */

interface AnthropicContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | Array<{ type: "text"; text: string }>;
  cache_control?: { type: "ephemeral" };
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

function toAnthropicMessages(
  messages: Message[],
  enableCaching = false,
): {
  system: string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  anthropicMessages: AnthropicMessage[];
} {
  const systemParts: string[] = [];
  const anthropicMessages: AnthropicMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLastMessage = i === messages.length - 1;

    if (msg.role === "system") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : (msg.content as Array<{ type: "text"; text: string }>)
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n");
      systemParts.push(text);
      continue;
    }

    const role: "user" | "assistant" = msg.role === "assistant" ? "assistant" : "user";
    const contentParts = Array.isArray(msg.content) ? msg.content : [msg.content];

    if (msg.role === "tool") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      anthropicMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id ?? "unknown",
            content: text,
          },
        ],
      });
      continue;
    }

    const blocks: AnthropicContentBlock[] = [];

    for (const part of contentParts) {
      if (typeof part === "string") {
        blocks.push({ type: "text", text: part });
      } else if (part.type === "text") {
        blocks.push({ type: "text", text: part.text });
      } else if (part.type === "image_url") {
        const url = part.image_url.url;
        const match = url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          blocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: `image/${match[1]}`,
              data: match[2],
            },
          });
        }
      }
    }

    // Add cache_control to the last user message for prompt caching
    if (enableCaching && role === "user" && blocks.length > 0 && isLastMessage) {
      blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
    }

    anthropicMessages.push({ role, content: blocks });
  }

  const systemText = systemParts.join("\n");

  // System prompt with optional cache_control
  if (enableCaching && systemText) {
    const systemArray = [
      { type: "text" as const, text: systemText, cache_control: { type: "ephemeral" as const } },
    ];
    return { system: systemArray, anthropicMessages };
  }
  return { system: systemText || "", anthropicMessages };
}

/* ─── Tool translation ─────────────────────────────────────────────────── */

function toAnthropicTools(tools?: Tool[]):
  | Array<{
      name: string;
      description?: string;
      input_schema: Record<string, unknown>;
    }>
  | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
}

/* ─── Main entry point ─────────────────────────────────────────────────── */

export async function invokeAnthropic(
  params: InvokeParams,
  apiKey: string,
  options: ProviderInvokeOptions & { enableCaching?: boolean; thinkingBudget?: number } = {},
): Promise<InvokeResult> {
  if (options.killSwitchActive) {
    throw new RuntimePolicyError("LLM API request blocked by Rakshex Kill Switch.", {
      context: { policy: "kill_switch" },
    });
  }

  const model = options.model ?? "claude-3-5-sonnet-20241022";
  const { system, anthropicMessages } = toAnthropicMessages(
    params.messages,
    options.enableCaching ?? false,
  );

  const body: Record<string, unknown> = {
    model,
    messages: anthropicMessages,
    max_tokens: params.maxTokens ?? params.max_tokens ?? 4096,
  };

  if (system) body.system = system;

  const anthropicTools = toAnthropicTools(params.tools);
  if (anthropicTools && anthropicTools.length > 0) {
    body.tools = anthropicTools;
  }

  const toolChoice = params.toolChoice ?? params.tool_choice;
  if (toolChoice) {
    if (toolChoice === "auto") {
      body.tool_choice = { type: "auto" };
    } else if ((toolChoice as string) === "any" || toolChoice === "required") {
      body.tool_choice = { type: "any" as const };
    } else if (typeof toolChoice === "object" && "name" in toolChoice) {
      body.tool_choice = { type: "tool", name: toolChoice.name };
    } else if (typeof toolChoice === "object" && "function" in toolChoice) {
      body.tool_choice = { type: "tool", name: toolChoice.function.name };
    }
  }

  // Extended thinking
  if (options.thinkingBudget && options.thinkingBudget > 0) {
    body.thinking = { type: "enabled", budget_tokens: options.thinkingBudget };
    body.max_tokens = Math.max((body.max_tokens as number) || 4096, options.thinkingBudget + 1024);
  }

  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    timeoutMs: 120_000,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      ...(options.enableCaching ? { "anthropic-beta": "prompt-caching-2024-07-31" } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ExternalServiceError(
      `Anthropic invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request via Anthropic failed. Please try again.",
        context: {
          provider: "anthropic",
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
    content: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: unknown;
    }>;
    stop_reason: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  const textContent = raw.content
    .filter((b) => b.type === "text")
    .map((b) => ({ type: "text" as const, text: b.text ?? "" }));

  const toolCalls: ToolCall[] = raw.content
    .filter((b) => b.type === "tool_use")
    .map((b) => ({
      id: b.id ?? `toolu_${Date.now()}`,
      type: "function" as const,
      function: {
        name: b.name ?? "unknown",
        arguments: JSON.stringify(b.input ?? {}),
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
          content: textContent.length === 1 ? textContent[0].text : textContent,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: raw.stop_reason === "end_turn" ? "stop" : (raw.stop_reason ?? "stop"),
      },
    ],
    usage: {
      prompt_tokens: raw.usage.input_tokens,
      completion_tokens: raw.usage.output_tokens,
      total_tokens: raw.usage.input_tokens + raw.usage.output_tokens,
    },
  };

  // Auto-track token usage
  if (options.userId && result.usage) {
    const pricing = ANTHROPIC_PRICING[model] ?? { prompt: 3, completion: 15 };
    const cost =
      (result.usage.prompt_tokens / 1_000_000) * pricing.prompt +
      (result.usage.completion_tokens / 1_000_000) * pricing.completion;
    // Extended-thinking tokens are estimated from any `thinking` content
    // blocks (Claude 3.7+); they are NOT the same as cache-read tokens.
    const { thinkingTokens } = estimateAnthropicThinkingTokens(raw);
    import("../db").then(async (db) => {
      try {
        await db.recordTokenUsage(
          options.userId!,
          model,
          result.usage!.prompt_tokens,
          result.usage!.completion_tokens,
          thinkingTokens,
          cost,
        );
      } catch (err) {
        logger.warn({ err }, "[Anthropic] Failed to record token usage");
      }
    });
  }

  return result;
}

/* ─── LLMProvider conformance ──────────────────────────────────────────── */

export const anthropicProvider: LLMProvider = {
  name: "anthropic",
  defaultModel: "claude-3-5-sonnet-20241022",

  async invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError("Anthropic API key not configured.", {
        safeMessage: "Anthropic AI is not configured. Please contact support.",
      });
    }
    return invokeAnthropic(params, apiKey, {
      ...options,
      enableCaching: process.env.ANTHROPIC_CACHE_ENABLED === "true",
      thinkingBudget: process.env.ANTHROPIC_THINKING_BUDGET
        ? parseInt(process.env.ANTHROPIC_THINKING_BUDGET, 10)
        : undefined,
    });
  },

  supportsModel: (model: string) => model.startsWith("claude-"),

  supportsVision: () => true,
  supportsPromptCaching: () => true,
};
