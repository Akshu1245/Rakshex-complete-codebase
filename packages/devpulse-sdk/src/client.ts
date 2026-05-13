/**
 * DevPulse SDK — Main Client
 *
 * Creates a DevPulse telemetry client. Wraps LLM provider instances
 * to automatically capture and report all AI calls.
 */
import type { DevPulseConfig, TelemetryEvent, Provider } from "./types.js";
import { TelemetryCollector } from "./telemetry/collector.js";
import { BatchReporter } from "./reporters/batch.js";
import { wrapOpenAI } from "./wrappers/openai.js";
import { wrapAnthropic } from "./wrappers/anthropic.js";

const DEFAULT_INGEST_URL = "https://api.devpulse.in/v2/telemetry/events";

export class DevPulse {
  private config: Required<DevPulseConfig>;
  private reporter: BatchReporter;
  private collector: TelemetryCollector;

  constructor(config: DevPulseConfig) {
    this.config = {
      ingestUrl: DEFAULT_INGEST_URL,
      sampleRate: 1.0,
      redactPII: true,
      batchSize: 50,
      flushIntervalMs: 5000,
      maxRetries: 3,
      timeoutMs: 10000,
      ...config,
    };

    this.collector = new TelemetryCollector(this.config);
    this.reporter = new BatchReporter(this.config, this.collector);
    this.reporter.start();
  }

  /**
   * Wrap an OpenAI client instance. All completions, embeddings, etc.
   * will be automatically captured and reported.
   */
  wrap<T extends object>(client: T & { _devpulseWrapped?: true }): T {
    // Detect provider by constructor name
    const name = client.constructor?.name || "";

    if (name === "OpenAI" || (client as any).chat?.completions?.create) {
      return wrapOpenAI(client as any, this.collector) as unknown as T;
    }

    if (name === "Anthropic" || (client as any).messages?.create) {
      return wrapAnthropic(client as any, this.collector) as unknown as T;
    }

    // Unknown provider — pass through
    return client;
  }

  /**
   * Manually capture a telemetry event (for non-standard providers).
   */
  capture(event: Omit<TelemetryEvent, "eventId" | "workspaceId" | "requestTimestamp">): void {
    this.collector.capture(event as any);
  }

  /**
   * Flush pending telemetry immediately. Call before process exit.
   */
  async flush(): Promise<void> {
    await this.reporter.flush();
  }

  /**
   * Shutdown the SDK — flush remaining events and stop the reporter.
   */
  async shutdown(): Promise<void> {
    await this.reporter.shutdown();
  }
}
