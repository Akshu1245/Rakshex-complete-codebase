import type { AgentGuardClient } from "../client.js";
import { instrumentProviderCall, type WrapOptions } from "./base.js";

export function wrapOpenRouter(guard: AgentGuardClient) {
  return {
    async chatCompletionsCreate<T extends Record<string, unknown>>(
      client: { chat: { completions: { create: (body: unknown) => Promise<T> } } },
      body: { model: string; messages?: Array<{ content?: string }>; [k: string]: unknown },
      opts?: WrapOptions,
    ): Promise<T> {
      return instrumentProviderCall(guard, "openrouter", {
        model: body.model,
        correlationId: opts?.correlationId,
        retryCount: opts?.retryCount,
        toolCalls: opts?.toolCalls,
        metadata: opts?.metadata,
        prompt: body.messages?.map((m) => m.content ?? "").join("\n"),
        fn: () => client.chat.completions.create(body),
        extract: (result) => {
          const usage = (result as { usage?: Record<string, number> }).usage ?? {};
          return {
            inputTokens: usage.prompt_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? 0,
            cachedTokens: 0,
            costUsd: (result as { usage?: { cost?: number } }).usage?.cost,
          };
        },
      });
    },
  };
}
