/**
 * Google Gemini provider adapter — calls the Gemini API via the
 * generateContent endpoint, translating the gateway's canonical types.
 *
 * Supports:
 *   - Gemini 2.5 Flash/Pro (latest)
 *   - Gemini 2.0 Flash/Pro
 *   - Gemini 1.5 Flash/Pro
 *   - Vision (image content blocks via base64 inline data)
 *
 * Auth: reads GOOGLE_API_KEY from environment.
 */

import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { ExternalServiceError, RuntimePolicyError } from "../_core/errors";
import { logger } from "../_core/logger";
import type {
  InvokeParams,
  InvokeResult,
  Message,
  MessageContent,
  TextContent,
  ToolCall,
  Tool,
} from "../_core/llm";
import type { LLMProvider, ProviderInvokeOptions } from "../_core/providers";

/* ─── Pricing (per 1M tokens, USD) ─────────────────────────────────────── */

const GEMINI_PRICING: Record<string, { prompt: number; completion: number }> = {
  "gemini-2.5-flash": { prompt: 0.15, completion: 0.60 },
  "gemini-2.5-pro": { prompt: 1.25, completion: 10.0 },
  "gemini-2.0-flash": { prompt: 0.10, completion: 0.40 },
  "gemini-2.0-pro": { prompt: 1.25, completion: 5.0 },
  "gemini-1.5-flash": { prompt: 0.075, completion: 0.30 },
  "gemini-1.5-pro": { prompt: 1.25, completion: 5.0 },
};

/* ─── Message format translation ───────────────────────────────────────── */

interface GeminiContent {
  role?: "user" | "model";
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
}

function toGeminiContents(messages: Message[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
} {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const text = typeof msg.content === "string"
        ? msg.content
        : (msg.content as TextContent[])
            .filter(c => c.type === "text")
            .map(c => c.text)
            .join("\n");
      systemParts.push(text);
      continue;
    }

    const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";
    const parts: GeminiPart[] = [];

    // Handle tool results
    if (msg.role === "tool") {
      const response = typeof msg.content === "string"
        ? { result: msg.content }
        : (typeof msg.content === "object" ? msg.content as Record<string, unknown> : { result: String(msg.content) });
      parts.push({
        functionResponse: {
          name: msg.name ?? msg.tool_call_id ?? "unknown",
          response,
        },
      });
      contents.push({ role: "user", parts });
      continue;
    }

    const contentParts = Array.isArray(msg.content) ? msg.content : [msg.content];

    // Check for tool_calls
    const toolCalls: ToolCall[] | undefined = (
      msg as Message & { tool_calls?: ToolCall[] }
    ).tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = { _raw: tc.function.arguments };
        }
        parts.push({
          functionCall: {
            name: tc.function.name,
            args,
          },
        });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    // Normal content
    for (const part of contentParts) {
      if (typeof part === "string") {
        parts.push({ text: part });
      } else if (part.type === "text") {
        parts.push({ text: part.text });
      } else if (part.type === "image_url") {
        const url = part.image_url.url;
        const match = url.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: `image/${match[1]}`,
              data: match[2],
            },
          });
        }
      }
    }

    contents.push({ role, parts });
  }

  return {
    systemInstruction: systemParts.length > 0
      ? { parts: systemParts.map(t => ({ text: t })) }
      : undefined,
    contents,
  };
}

/* ─── Tool translation ─────────────────────────────────────────────────── */

function toGeminiTools(tools?: Tool[]): GeminiTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return [{
    functionDeclarations: tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })),
  }];
}

/* ─── Response translation ─────────────────────────────────────────────── */

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      role: string;
      parts: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: Record<string, unknown>;
        };
      }>;
    };
    finishReason?: string;
    safetyRatings?: unknown[];
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
}

function fromGeminiResponse(raw: GeminiResponse, model: string): InvokeResult {
  const candidate = raw.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const textParts = parts
    .filter(p => "text" in p)
    .map(p => ({ type: "text" as const, text: p.text ?? "" }));

  const toolCalls: ToolCall[] = parts
    .filter(p => "functionCall" in p && p.functionCall)
    .map((p, i) => ({
      id: `call_${Date.now()}_${i}`,
      type: "function" as const,
      function: {
        name: p.functionCall!.name,
        arguments: JSON.stringify(p.functionCall!.args),
      },
    }));

  const finishMap: Record<string, string | null> = {
    STOP: "stop",
    MAX_TOKENS: "length",
    SAFETY: "content_filter",
    RECITATION: "content_filter",
    MALFORMED_FUNCTION_CALL: "tool_calls",
  };

  return {
    id: `gemini_${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textParts.length === 1 ? textParts[0].text : textParts,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: finishMap[candidate?.finishReason ?? ""] ?? candidate?.finishReason ?? null,
    }],
    usage: raw.usageMetadata
      ? {
          prompt_tokens: raw.usageMetadata.promptTokenCount,
          completion_tokens: raw.usageMetadata.candidatesTokenCount,
          total_tokens: raw.usageMetadata.totalTokenCount,
        }
      : undefined,
  };
}

/* ─── Main entry point ─────────────────────────────────────────────────── */

export async function invokeGemini(
  params: InvokeParams,
  apiKey: string,
  options: ProviderInvokeOptions & { baseUrl?: string } = {}
): Promise<InvokeResult> {
  if (options.killSwitchActive) {
    throw new RuntimePolicyError(
      "LLM API request blocked by DevPulse Kill Switch.",
      { context: { policy: "kill_switch" } }
    );
  }

  const model = options.model ?? "gemini-2.5-flash";
  const { systemInstruction, contents } = toGeminiContents(params.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? params.max_tokens ?? 8192,
      temperature: 0.7,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  const geminiTools = toGeminiTools(params.tools);
  if (geminiTools) {
    body.tools = geminiTools;
  }

  const toolChoice = params.toolChoice ?? params.tool_choice;
  if (toolChoice) {
    if ((toolChoice as string) === "none") {
      body.toolConfig = { functionCallingConfig: { mode: "NONE" } };
    } else if (toolChoice === "auto" || (toolChoice as string) === "required") {
      body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
    } else if (typeof toolChoice === "object" && "name" in toolChoice) {
      body.toolConfig = {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: [toolChoice.name],
        },
      };
    }
  }

  const baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetchWithTimeout(url, {
    method: "POST",
    timeoutMs: 120_000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ExternalServiceError(
      `Gemini invoke failed (${model}): ${response.status} ${response.statusText}`,
      {
        safeMessage: "AI request via Gemini failed. Please try again.",
        context: { provider: "gemini", model, status: response.status, body: errorText.slice(0, 500) },
      }
    );
  }

  const raw = (await response.json()) as GeminiResponse;

  // Check for blocked content
  if (!raw.candidates || raw.candidates.length === 0) {
    throw new ExternalServiceError(
      "Gemini returned no candidates — content may be blocked by safety filters.",
      { safeMessage: "The AI response was blocked by safety filters. Please try a different prompt." }
    );
  }

  const result = fromGeminiResponse(raw, model);

  // Auto-track token usage
  if (options.userId && result.usage) {
    const pricing = Object.entries(GEMINI_PRICING).find(([k]) => model.startsWith(k));
    const { prompt: ppm, completion: cpm } = pricing?.[1] ?? { prompt: 0.15, completion: 0.60 };
    const cost = (result.usage.prompt_tokens / 1_000_000) * ppm +
      (result.usage.completion_tokens / 1_000_000) * cpm;

    import("../db").then(async db => {
      try {
        await db.recordTokenUsage(
          options.userId!,
          model,
          result.usage!.prompt_tokens,
          result.usage!.completion_tokens,
          raw.usageMetadata?.thoughtsTokenCount ?? 0,
          cost
        );
      } catch (err) {
        logger.warn({ err }, "[Gemini] Failed to record token usage");
      }
    });
  }

  return result;
}

/* ─── LLMProvider conformance ──────────────────────────────────────────── */

export const geminiProvider: LLMProvider = {
  name: "gemini",
  defaultModel: "gemini-2.5-flash",

  async invoke(params: InvokeParams, options?: ProviderInvokeOptions): Promise<InvokeResult> {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ExternalServiceError(
        "Google API key not configured for Gemini.",
        { safeMessage: "Gemini AI is not configured. Please contact support." }
      );
    }
    return invokeGemini(params, apiKey, options);
  },

  supportsModel: (model: string) =>
    model.startsWith("gemini-"),

  supportsVision: () => true,
  supportsPromptCaching: () => false,
};
