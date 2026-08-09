import type { AgentGuardClient } from "../client.js";
import { instrumentProviderCall, type WrapOptions } from "./base.js";

/** Azure OpenAI uses OpenAI-compatible shapes; tag provider as azure_openai. */
export function wrapAzureOpenAI(guard: AgentGuardClient) {
  return {
    async chatCompletionsCreate<T extends Record<string, unknown>>(
      client: { chat: { completions: { create: (body: unknown) => Promise<T> } } },
      body: { model: string; messages?: Array<{ content?: string }>; [k: string]: unknown },
      opts?: WrapOptions,
    ): Promise<T> {
      return instrumentProviderCall(guard, "azure_openai", {
        model: body.model,
        correlationId: opts?.correlationId,
        retryCount: opts?.retryCount,
        toolCalls: opts?.toolCalls,
        metadata: { ...opts?.metadata, azure: true },
        prompt: body.messages?.map((m) => m.content ?? "").join("\n"),
        fn: () => client.chat.completions.create(body),
        extract: (result) => {
          const usage = (result as { usage?: Record<string, number> }).usage ?? {};
          return {
            inputTokens: usage.prompt_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? 0,
            cachedTokens: 0,
          };
        },
      });
    },
  };
}
