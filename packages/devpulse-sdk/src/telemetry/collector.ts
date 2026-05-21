/**
 * Rakshex SDK — Telemetry Collector
 *
 * Captures and enriches telemetry events: PII redaction, hashing,
 * cost calculation. Runs entirely client-side before any data leaves.
 */
import { randomUUID } from "crypto";
import type {
  RakshexConfig,
  TelemetryEvent,
  Provider,
  ToolCallRecord,
  ChatMessage,
} from "../types.js";
import { redactPII, hashContent } from "./redact.js";
import { calculateCost } from "./cost.js";

export class TelemetryCollector {
  private config: Required<RakshexConfig>;

  constructor(config: Required<RakshexConfig>) {
    this.config = config;
  }

  /**
   * Build a telemetry event from a completed LLM call.
   */
  buildEvent(params: {
    provider: Provider;
    model: string;
    messages: ChatMessage[];
    responseMessages: ChatMessage[];
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    latencyMs: number;
    status: "ok" | "error" | "timeout" | "blocked";
    userId?: string;
    agentId?: string;
    toolCalls?: ToolCallRecord[];
    metadata?: Record<string, unknown>;
  }): TelemetryEvent {
    // Apply PII redaction (client-side, before any data leaves)
    let promptText = this.messagesToString(params.messages);
    let responseText = this.messagesToString(params.responseMessages);
    let redactionCount = 0;

    if (this.config.redactPII) {
      const promptResult = redactPII(promptText);
      const responseResult = redactPII(responseText);
      promptText = promptResult.text;
      responseText = responseResult.text;
      redactionCount = promptResult.redactionCount + responseResult.redactionCount;
    }

    // Calculate cost
    const { costUsd } = calculateCost(
      params.model,
      params.inputTokens,
      params.outputTokens,
      params.cachedTokens,
    );

    // Hash content (so we can detect duplicates without storing raw text)
    const promptHash = hashContent(promptText);
    const responseHash = hashContent(responseText);

    return {
      eventId: randomUUID(),
      workspaceId: this.config.workspaceId,
      agentId: params.agentId || "default",
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      requestTimestamp: new Date().toISOString(),
      latencyMs: params.latencyMs,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cachedTokens: params.cachedTokens,
      costUsd,
      status: params.status,
      redactionCount,
      promptHash,
      responseHash,
      toolCalls: params.toolCalls || null,
      metadata: params.metadata || {},
    };
  }

  /**
   * Manually capture a pre-built event (or partial event).
   */
  capture(
    event: Omit<TelemetryEvent, "eventId" | "workspaceId" | "requestTimestamp">,
  ): TelemetryEvent {
    return {
      eventId: randomUUID(),
      workspaceId: this.config.workspaceId,
      requestTimestamp: new Date().toISOString(),
      ...event,
    } as TelemetryEvent;
  }

  private messagesToString(messages: ChatMessage[]): string {
    return messages
      .map((m) => {
        if (typeof m.content === "string") return `${m.role}: ${m.content}`;
        if (Array.isArray(m.content)) {
          return `${m.role}: ${m.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join(" ")}`;
        }
        return `${m.role}: [non-text content]`;
      })
      .join("\n");
  }
}
