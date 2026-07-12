import type { AgentGuardClient } from "../client.js";
import { instrumentProviderCall, type WrapOptions } from "./base.js";

/**
 * OpenAI-compatible chat completions wrapper.
 * Pass your existing OpenAI client; AgentGuard never sees the OpenAI API key.
 */
export function wrapOpenAI(guard: AgentGuardClient) {
  return {
    async chatCompletionsCreate<T extends Record<string, unknown>>(
      client: { chat: { completions: { create: (body: unknown) => Promise<T> } } },
      body: {
        model: string;
        messages?: Array<{ role: string; content?: string }>;
        [k: string]: unknown;
      },
      opts?: WrapOptions,
    ): Promise<T> {
      const prompt = body.messages?.map((m) => m.content ?? "").join("\n") ?? undefined;
      return instrumentProviderCall(guard, "openai", {
        model: body.model,
        correlationId: opts?.correlationId,
        retryCount: opts?.retryCount,
        toolCalls: opts?.toolCalls,
        metadata: opts?.metadata,
        prompt,
        fn: () => client.chat.completions.create(body),
        extract: (result) => {
          const usage =
            (
              result as {
                usage?: {
                  prompt_tokens?: number;
                  input_tokens?: number;
                  completion_tokens?: number;
                  output_tokens?: number;
                  cached_tokens?: number;
                  prompt_tokens_details?: { cached_tokens?: number };
                };
              }
            ).usage ?? {};
          return {
            inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
            cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? usage.cached_tokens ?? 0,
          };
        },
      });
    },
  };
}
