import type { AgentGuardClient } from "../client.js";
import { instrumentProviderCall, type WrapOptions } from "./base.js";

export function wrapBedrock(guard: AgentGuardClient) {
  return {
    async invokeModel<T extends Record<string, unknown>>(
      invoke: (input: unknown) => Promise<T>,
      input: { modelId: string; body?: unknown; [k: string]: unknown },
      opts?: WrapOptions,
    ): Promise<T> {
      return instrumentProviderCall(guard, "bedrock", {
        model: input.modelId,
        correlationId: opts?.correlationId,
        retryCount: opts?.retryCount,
        toolCalls: opts?.toolCalls,
        metadata: opts?.metadata,
        fn: () => invoke(input),
        extract: (result) => {
          // Bedrock usage varies by model; prefer headers / ResponseMetadata if present
          const usage =
            (result as { usage?: Record<string, number> }).usage ??
            (result as { ResponseMetadata?: { usage?: Record<string, number> } }).ResponseMetadata
              ?.usage ??
            {};
          return {
            inputTokens: usage.inputTokens ?? usage.input_tokens ?? 0,
            outputTokens: usage.outputTokens ?? usage.output_tokens ?? 0,
            cachedTokens: usage.cacheReadInputTokens ?? 0,
          };
        },
      });
    },
  };
}
