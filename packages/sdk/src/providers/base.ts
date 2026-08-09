import type { AgentGuardClient } from "../client.js";
import type { CaptureContext, ProviderName, ToolCallRecord } from "../types.js";

export interface WrapOptions {
  model: string;
  correlationId?: string;
  retryCount?: number;
  toolCalls?: ToolCallRecord[];
  metadata?: Record<string, unknown>;
}

/**
 * Shared helper for provider wrappers.
 * Provider API keys stay on the underlying client — never passed to AgentGuard.
 */
export async function instrumentProviderCall<T>(
  guard: AgentGuardClient,
  provider: ProviderName,
  opts: WrapOptions & {
    fn: () => Promise<T>;
    extract: (result: T) => {
      inputTokens?: number;
      outputTokens?: number;
      cachedTokens?: number;
      costUsd?: number;
    };
    prompt?: string;
  },
): Promise<T> {
  const start = Date.now();
  const base: CaptureContext = {
    provider,
    model: opts.model,
    correlationId: opts.correlationId,
    retryCount: opts.retryCount,
    toolCalls: opts.toolCalls,
    metadata: opts.metadata,
    prompt: opts.prompt,
  };

  try {
    const result = await opts.fn();
    const usage = opts.extract(result);
    guard.capture({
      ...base,
      ...usage,
      latencyMs: Date.now() - start,
      status: "ok",
    });
    return result;
  } catch (err) {
    guard.capture({
      ...base,
      latencyMs: Date.now() - start,
      status: "error",
      errorMessage: err instanceof Error ? err.message.slice(0, 500) : String(err),
      errorCode: err instanceof Error ? err.name : "Error",
    });
    throw err;
  }
}
