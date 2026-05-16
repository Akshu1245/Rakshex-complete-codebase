/**
 * DevPulse SDK — Batch Reporter
 *
 * Batches telemetry events and sends them to the DevPulse ingest API.
 * Runs a flush timer. Handles retries, backpressure, and shutdown.
 */
import type { DevPulseConfig, TelemetryEvent } from "../types.js";
import type { TelemetryCollector } from "../telemetry/collector.js";

export class BatchReporter {
  private config: Required<DevPulseConfig>;
  private collector: TelemetryCollector;
  private buffer: TelemetryEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(config: Required<DevPulseConfig>, collector: TelemetryCollector) {
    this.config = config;
    this.collector = collector;
  }

  start(): void {
    this.timer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  enqueue(event: TelemetryEvent): void {
    // Apply sampling
    if (Math.random() > this.config.sampleRate) return;

    this.buffer.push(event);

    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.flushing = true;
    const batch = this.buffer.splice(0, this.config.batchSize);

    try {
      await this.sendBatch(batch);
    } catch {
      // Re-queue failed events (up to max retries)
      for (const event of batch) {
        const retries = ((event.metadata as any)?._retries || 0) + 1;
        if (retries <= this.config.maxRetries) {
          (event.metadata as any)._retries = retries;
          this.buffer.unshift(event);
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  private async sendBatch(events: TelemetryEvent[]): Promise<void> {
    const body = JSON.stringify({ events });
    const compressed = await this.compress(body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.ingestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": compressed.encoding,
          "Authorization": `Bearer ${this.config.apiKey}`,
          "X-Workspace-Id": this.config.workspaceId,
          "X-SDK-Version": "0.1.0",
        },
        body: compressed.data as BodyInit,
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          await new Promise((r) => setTimeout(r, parseInt(retryAfter) * 1000));
        }
        throw new Error(`Ingest API returned ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async compress(data: string): Promise<{ encoding: string; data: Uint8Array }> {
    // Use CompressionStream if available (Node 17+), fall back to plain
    try {
      const encoder = new TextEncoder();
      const stream = new CompressionStream("gzip");
      const writer = stream.writable.getWriter();
      writer.write(encoder.encode(data));
      writer.close();

      const reader = stream.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const total = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
      let offset = 0;
      for (const c of chunks) {
        total.set(c, offset);
        offset += c.length;
      }

      return { encoding: "gzip", data: total };
    } catch {
      return { encoding: "identity", data: new TextEncoder().encode(data) };
    }
  }
}
