import { randomId, sha256Hex } from "./hash.js";
import { OfflineQueue } from "./offline-queue.js";
import { applyPrivacy, assertNotProviderKey } from "./privacy.js";
import { sendBatch } from "./transport.js";
import type {
  AgentGuardClientOptions,
  CaptureContext,
  PrivacyMode,
  TransportResult,
  UsageEvent,
} from "./types.js";

export const SDK_NAME = "@rakshex/agentguard-sdk" as const;
export const SDK_VERSION = "0.1.0" as const;

const DEFAULT_GATEWAY = "https://api.rakshex.com";

export class AgentGuardClient {
  readonly options: Required<
    Pick<
      AgentGuardClientOptions,
      | "apiKey"
      | "gatewayUrl"
      | "privacyMode"
      | "failOpen"
      | "batchSize"
      | "flushIntervalMs"
      | "maxRetries"
      | "offlineQueueMax"
    >
  > &
    AgentGuardClientOptions;

  private buffer: UsageEvent[] = [];
  private offline: OfflineQueue;
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private fetchImpl: typeof fetch;

  constructor(options: AgentGuardClientOptions) {
    if (!options.apiKey) {
      throw new Error("AgentGuard requires apiKey (Rakshex workspace key)");
    }
    assertNotProviderKey(options.apiKey);

    this.options = {
      gatewayUrl: options.gatewayUrl ?? DEFAULT_GATEWAY,
      privacyMode: options.privacyMode ?? "metadata_only",
      failOpen: options.failOpen ?? true,
      batchSize: options.batchSize ?? 20,
      flushIntervalMs: options.flushIntervalMs ?? 2000,
      maxRetries: options.maxRetries ?? 3,
      offlineQueueMax: options.offlineQueueMax ?? 1000,
      ...options,
    };

    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.offline = new OfflineQueue({
      max: this.options.offlineQueueMax,
      path: options.offlineQueuePath,
    });

    if (this.options.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.options.flushIntervalMs);
      if (typeof this.timer === "object" && "unref" in this.timer) {
        (this.timer as NodeJS.Timeout).unref();
      }
    }
  }

  isConfigured(): boolean {
    return Boolean(this.options.apiKey) && !this.closed;
  }

  get privacyMode(): PrivacyMode {
    return this.options.privacyMode ?? "metadata_only";
  }

  /** Create or reuse a correlation ID for multi-step agent runs. */
  correlationId(existing?: string): string {
    return existing ?? randomId();
  }

  /**
   * Record a usage event. Never throws on transport failure when failOpen=true.
   * Does not capture prompt content unless privacyMode allows it.
   */
  capture(ctx: CaptureContext): UsageEvent {
    const correlationId = this.correlationId(ctx.correlationId);
    const mode = this.privacyMode;
    let redactionCount = 0;

    let promptHash: string | undefined;
    let responseHash: string | undefined;
    let promptContent: string | undefined;
    let responseContent: string | undefined;

    if (ctx.prompt && mode !== "zero_retention") {
      promptHash = sha256Hex(ctx.prompt);
      if (mode === "full_content" || mode === "redacted_content") {
        promptContent = ctx.prompt;
      }
    }
    if (ctx.response && mode !== "zero_retention") {
      responseHash = sha256Hex(ctx.response);
      if (mode === "full_content" || mode === "redacted_content") {
        responseContent = ctx.response;
      }
    }

    const raw: UsageEvent = {
      eventId: randomId(),
      correlationId,
      workspaceId: this.options.workspaceId,
      projectId: this.options.projectId,
      agentId: this.options.agentId,
      provider: ctx.provider,
      model: ctx.model,
      requestTimestamp: new Date().toISOString(),
      latencyMs: ctx.latencyMs ?? 0,
      inputTokens: ctx.inputTokens ?? 0,
      outputTokens: ctx.outputTokens ?? 0,
      cachedTokens: ctx.cachedTokens ?? 0,
      costUsd: ctx.costUsd ?? 0,
      costKind: ctx.costKind ?? "estimate",
      status: ctx.status ?? "ok",
      errorCode: ctx.errorCode,
      errorMessage: ctx.errorMessage,
      retryCount: ctx.retryCount ?? 0,
      toolCalls: ctx.toolCalls ?? [],
      agentSteps: ctx.agentSteps ?? [],
      promptHash,
      responseHash,
      promptContent,
      responseContent,
      redactionCount,
      metadata: ctx.metadata ?? {},
      sdkVersion: SDK_VERSION,
    };

    const event = applyPrivacy(raw, mode);

    // local_only: keep in offline queue only (never network)
    if (mode === "local_only") {
      this.offline.enqueue(event);
      return event;
    }

    // zero_retention: do not persist at all after in-memory metrics
    if (mode === "zero_retention") {
      return event;
    }

    this.buffer.push(event);
    if (this.buffer.length >= (this.options.batchSize ?? 20)) {
      void this.flush();
    }
    return event;
  }

  /**
   * Wrap an async provider call: measure latency, capture tokens/errors, rethrow.
   * Application always gets the original result/error even if telemetry fails.
   */
  async wrapCall<T>(
    ctx: Omit<CaptureContext, "latencyMs" | "status" | "errorMessage"> & {
      fn: () => Promise<T>;
      extractUsage?: (result: T) => Partial<CaptureContext>;
    },
  ): Promise<T> {
    const start = Date.now();
    let retryCount = ctx.retryCount ?? 0;
    try {
      const result = await ctx.fn();
      const extra = ctx.extractUsage?.(result) ?? {};
      this.capture({
        ...ctx,
        ...extra,
        latencyMs: Date.now() - start,
        status: "ok",
        retryCount,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.capture({
        ...ctx,
        latencyMs: Date.now() - start,
        status: "error",
        errorMessage: message.slice(0, 500),
        errorCode: err instanceof Error ? err.name : "Error",
        retryCount,
      });
      throw err;
    }
  }

  async flush(): Promise<TransportResult> {
    if (this.closed) return { ok: true };
    if (this.privacyMode === "local_only" || this.privacyMode === "zero_retention") {
      return { ok: true };
    }

    const batch = this.buffer.splice(0, this.buffer.length);
    // Also try offline drain
    const offline = this.offline.peek(50);
    const events = [...offline, ...batch];
    if (events.length === 0) return { ok: true };

    try {
      const result = await sendBatch(events, {
        gatewayUrl: this.options.gatewayUrl!,
        apiKey: this.options.apiKey,
        maxRetries: this.options.maxRetries ?? 3,
        fetchImpl: this.fetchImpl,
        failOpen: this.options.failOpen ?? true,
      });

      if (result.ok) {
        if (offline.length) this.offline.markFlushed(offline.length);
        return result;
      }

      // Queue failed events offline
      for (const e of events) {
        this.offline.enqueue(e);
      }
      if (this.options.failOpen) {
        return { ...result, queuedOffline: true };
      }
      return result;
    } catch (err) {
      for (const e of events) {
        this.offline.enqueue(e);
      }
      if (this.options.failOpen) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          queuedOffline: true,
        };
      }
      throw err;
    }
  }

  getOfflineQueueSize(): number {
    return this.offline.size;
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}

export function createAgentGuardClient(options: AgentGuardClientOptions): AgentGuardClient {
  return new AgentGuardClient(options);
}
