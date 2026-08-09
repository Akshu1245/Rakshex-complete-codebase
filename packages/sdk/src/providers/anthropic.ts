import type { AgentGuardClient } from "../client.js";
import { instrumentProviderCall, type WrapOptions } from "./base.js";

export function wrapAnthropic(guard: AgentGuardClient) {
  return {
    async messagesCreate<T extends Record<string, unknown>>(
      client: { messages: { create: (body: unknown) => Promise<T> } },
      body: {
        model: string;
        messages?: Array<{ role: string; content?: unknown }>;
        [k: string]: unknown;
      },
      opts?: WrapOptions,
    ): Promise<T> {
      const prompt = body.messages
        ?.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join("\n");
      return instrumentProviderCall(guard, "anthropic", {
        model: body.model,
        correlationId: opts?.correlationId,
        retryCount: opts?.retryCount,
        toolCalls: opts?.toolCalls,
        metadata: opts?.metadata,
        prompt,
        fn: () => client.messages.create(body),
        extract: (result) => {
          const usage = (result as { usage?: Record<string, number> }).usage ?? {};
          return {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
            cachedTokens: usage.cache_read_input_tokens ?? 0,
          };
        },
      });
    },
  };
}
