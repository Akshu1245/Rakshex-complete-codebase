import type { AgentGuardClient } from "../client.js";
import { instrumentProviderCall, type WrapOptions } from "./base.js";

export function wrapGemini(guard: AgentGuardClient) {
  return {
    async generateContent<T extends Record<string, unknown>>(
      generate: (req: unknown) => Promise<T>,
      req: { model?: string; contents?: unknown; [k: string]: unknown },
      opts?: WrapOptions & { model: string },
    ): Promise<T> {
      const model = opts?.model ?? req.model ?? "gemini-pro";
      return instrumentProviderCall(guard, "gemini", {
        model,
        correlationId: opts?.correlationId,
        retryCount: opts?.retryCount,
        toolCalls: opts?.toolCalls,
        metadata: opts?.metadata,
        prompt: typeof req.contents === "string" ? req.contents : undefined,
        fn: () => generate(req),
        extract: (result) => {
          const meta = (result as { usageMetadata?: Record<string, number> }).usageMetadata ?? {};
          return {
            inputTokens: meta.promptTokenCount ?? 0,
            outputTokens: meta.candidatesTokenCount ?? 0,
            cachedTokens: meta.cachedContentTokenCount ?? 0,
          };
        },
      });
    },
  };
}
