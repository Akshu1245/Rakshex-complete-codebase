/**
 * LLM Provider interface + registry + routing layer.
 *
 * Currently we only support MiniMax + Forge (fallback) via hardcoded
 * logic in invokeLLM(). This module extracts the provider-specific
 * concerns behind a common interface so we can add Bedrock, Anthropic,
 * and Azure with zero changes to the callers.
 */

import { ENV } from "./env";
import {
  ExternalServiceError,
  InternalError,
  RuntimePolicyError,
} from "./errors";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { logger } from "./logger";

import type {
  InvokeParams,
  InvokeResult,
  Message,
  Tool,
  ToolChoice,
  OutputSchema,
  ResponseFormat,
} from "./llm";

/* ─── Interface ────────────────────────────────────────────────────────── */

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;

  /** Invoke the LLM with the canonical DevPulse params. */
  invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult>;

  /** Whether this provider can handle a given model string. */
  supportsModel(model: string): boolean;

  /** Whether this provider accepts image content blocks natively. */
  supportsVision(): boolean;

  /** Whether this provider supports prompt caching (cache_control). */
  supportsPromptCaching(): boolean;
}

export interface ProviderInvokeOptions {
  /** Per-invoke override of the default model. */
  model?: string;
  /** Kill-switch state to check before invoking. */
  killSwitchActive?: boolean;
  /** User ID for token-usage tracking. */
  userId?: number;
}

/* ─── MiniMax / Forge Provider (existing backend) ──────────────────────── */

const MINIMAX_PRICING = {
  prompt: 0.4, // $0.40 / 1M prompt tokens
  completion: 2.0, // $2.00 / 1M completion tokens
};

function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

let _cachedResolveApiUrl: {
  url: string;
  key: string;
  model: string;
  provider: "minimax" | "forge";
} | null = null;

function resolveMiniMaxApiUrl() {
  if (_cachedResolveApiUrl) return _cachedResolveApiUrl;
  const minimaxKey = ENV.minimaxApiKey?.trim();
  if (minimaxKey) {
    _cachedResolveApiUrl = {
      url: `${ENV.minimaxApiUrl.replace(/\/$/, "")}/chat/completions`,
      key: minimaxKey,
      model: ENV.minimaxModel,
      provider: "minimax" as const,
    };
  } else {
    if (!ENV.forgeApiKey) {
      throw new InternalError(
        "No LLM API key configured. Set MINIMAX_API_KEY (recommended) or BUILT_IN_FORGE_API_KEY.",
        { safeMessage: "AI features are temporarily unavailable. Please try again shortly." }
      );
    }
    _cachedResolveApiUrl = {
      url: ENV.forgeApiUrl?.trim()
        ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
        : "https://forge.manus.im/v1/chat/completions",
      key: ENV.forgeApiKey,
      model: "gemini-2.5-flash",
      provider: "forge" as const,
    };
  }
  return _cachedResolveApiUrl;
}

async function miniMaxInvoke(
  params: InvokeParams,
  options: ProviderInvokeOptions = {}
): Promise<InvokeResult> {
  const { url, key, model: defaultModel, provider } = resolveMiniMaxApiUrl();
  const model = options.model ?? defaultModel;

  const payload: Record<string, unknown> = {
    model,
    messages: params.messages,
    max_tokens: params.maxTokens ?? params.max_tokens ?? 8192,
  };

  if (provider === "minimax") {
    payload.temperature = 1;
  } else {
    payload.thinking = { budget_tokens: 128 };
    payload.max_tokens = 32768;
  }

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }

  const toolChoice = params.toolChoice ?? params.tool_choice;
  if (toolChoice && toolChoice !== "none") {
    payload.tool_choice = toolChoice;
  }

  const fmt = params.responseFormat ?? params.response_format;
  const schema = params.outputSchema ?? params.output_schema;
  if (fmt) {
    payload.response_format = fmt;
  } else if (schema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: { name: schema.name, schema: schema.schema },
    };
  }

  const response = await fetchWithTimeout(url, {
    method: "POST",
    timeoutMs: 60_000,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ExternalServiceError(
      `LLM invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request failed. Please try again.",
        context: { provider, model, status: response.status, body: errorText },
      }
    );
  }

  const result = (await response.json()) as InvokeResult;

  if (provider === "minimax") {
    for (const choice of result.choices) {
      if (typeof choice.message.content === "string") {
        choice.message.content = stripThinkingTags(choice.message.content);
      }
    }
  }

  return result;
}

/* ─── Provider instances ───────────────────────────────────────────────── */

export const minimaxProvider: LLMProvider = {
  name: "minimax",
  defaultModel: ENV.minimaxModel || "MiniMax-M2.7",
  invoke: miniMaxInvoke,
  supportsModel: (model: string) =>
    model.startsWith("MiniMax") || model.startsWith("minimax"),
  supportsVision: () => false,
  supportsPromptCaching: () => false,
};

/* ─── Registry ─────────────────────────────────────────────────────────── */

class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    logger.info({ provider: provider.name }, "[Providers] registered");
  }

  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /** Find the first provider that supports a given model. */
  findForModel(model: string): LLMProvider | undefined {
    for (const p of this.providers.values()) {
      if (p.supportsModel(model)) return p;
    }
    return undefined;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}

export const providerRegistry = new ProviderRegistry();
providerRegistry.register(minimaxProvider);

/** Register optional providers based on available environment config. */
export async function registerOptionalProviders() {
  // Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { anthropicProvider } = await import("../services/anthropicProvider");
      providerRegistry.register(anthropicProvider);
    } catch (err) {
      logger.warn({ err }, "[Providers] Failed to load Anthropic provider");
    }
  }

  // Bedrock
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const { bedrockProvider } = await import("../services/bedrockProvider");
      providerRegistry.register(bedrockProvider);
    } catch (err) {
      logger.warn({ err }, "[Providers] Failed to load Bedrock provider");
    }
  }

  // Gemini
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      const { geminiProvider } = await import("../services/geminiProvider");
      providerRegistry.register(geminiProvider);
    } catch (err) {
      logger.warn({ err }, "[Providers] Failed to load Gemini provider");
    }
  }
}

/* ─── Main routing entry point ─────────────────────────────────────────── */

/**
 * Route an LLM invocation to the correct provider.
 *
 * Lookup order:
 *  1. If `provider` is specified, use that named provider.
 *  2. If `model` is specified, find the first provider that supports it.
 *  3. Fall back to the default (MiniMax).
 */
export async function routeLLM(
  params: InvokeParams & {
    provider?: string;
    model?: string;
    userId?: number;
    killSwitchActive?: boolean;
  }
): Promise<InvokeResult> {
  // Kill-switch check (inline, before any provider dispatch)
  if (params.killSwitchActive) {
    throw new RuntimePolicyError(
      "LLM API request blocked by DevPulse Kill Switch.",
      { context: { userId: params.userId, policy: "kill_switch" } }
    );
  }

  // Kill-switch DB lookup if userId is provided
  if (params.userId) {
    try {
      const { getKillSwitchSettings } = await import("../db");
      const ks = await getKillSwitchSettings(params.userId);
      if (ks?.isActive) {
        throw new RuntimePolicyError(
          "LLM API request blocked by DevPulse Kill Switch.",
          { context: { userId: params.userId, policy: "kill_switch" } }
        );
      }
    } catch (err) {
      if (err instanceof RuntimePolicyError) throw err;
      // DB might not be available — fail open
      logger.warn({ err }, "[Providers] kill-switch check failed, continuing");
    }
  }

  let provider: LLMProvider | undefined;

  if (params.provider) {
    provider = providerRegistry.get(params.provider);
    if (!provider) {
      throw new InternalError(`Unknown LLM provider: ${params.provider}`, {
        safeMessage: "AI features are temporarily unavailable.",
      });
    }
  } else if (params.model) {
    provider = providerRegistry.findForModel(params.model);
  }

  provider = provider ?? minimaxProvider;

  const result = await provider.invoke(params, {
    model: params.model,
    userId: params.userId,
    killSwitchActive: params.killSwitchActive,
  });

  // Auto-track token usage
  if (params.userId && result.usage) {
    const { prompt_tokens, completion_tokens } = result.usage;
    const cost = (prompt_tokens / 1_000_000) * MINIMAX_PRICING.prompt +
      (completion_tokens / 1_000_000) * MINIMAX_PRICING.completion;

    import("../db").then(async db => {
      try {
        await db.recordTokenUsage(
          params.userId!,
          provider!.defaultModel,
          prompt_tokens,
          completion_tokens,
          0,
          cost
        );
      } catch (err) {
        logger.warn({ err }, "[LLM] Failed to record token usage");
      }
    });
  }

  return result;
}

/**
 * Backwards-compatible wrapper that replaces the old `invokeLLM()`.
 * Callers that import `invokeLLM` from `_core/llm.ts` now get this
 * routed version automatically when they upgrade.
 */
export async function invokeLLM(
  params: InvokeParams & { userId?: number }
): Promise<InvokeResult> {
  return routeLLM(params);
}
