/**
 * AgentGuard SDK public types.
 * Prompt content is NEVER captured by default — only metadata and hashes.
 */

export type PrivacyMode =
  "metadata_only" | "redacted_content" | "full_content" | "local_only" | "zero_retention";

export type ProviderName =
  "openai" | "anthropic" | "gemini" | "azure_openai" | "bedrock" | "openrouter";

export type EventStatus = "ok" | "error" | "timeout" | "blocked" | "retry";

export interface ToolCallRecord {
  name: string;
  /** Argument keys only by default — never full args in metadata_only */
  argKeys?: string[];
  latencyMs?: number;
  error?: string;
}

export interface AgentStepRecord {
  step: number;
  kind: "llm" | "tool" | "planner" | "other";
  name?: string;
  latencyMs?: number;
}

export interface UsageEvent {
  eventId: string;
  correlationId: string;
  workspaceId?: string;
  projectId?: string;
  agentId?: string;
  provider: ProviderName | string;
  model: string;
  requestTimestamp: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  /** Estimated or exact cost in USD */
  costUsd: number;
  costKind: "estimate" | "exact";
  status: EventStatus;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  toolCalls: ToolCallRecord[];
  agentSteps: AgentStepRecord[];
  /** SHA-256 of prompt — never the prompt itself in metadata_only */
  promptHash?: string;
  responseHash?: string;
  /** Only populated when privacyMode allows content */
  promptContent?: string;
  responseContent?: string;
  redactionCount: number;
  metadata: Record<string, unknown>;
  sdkVersion: string;
}

export interface AgentGuardClientOptions {
  /** Rakshex workspace API key — never a provider key */
  apiKey: string;
  /** Telemetry / gateway base URL */
  gatewayUrl?: string;
  privacyMode?: PrivacyMode;
  workspaceId?: string;
  projectId?: string;
  agentId?: string;
  /** Fail open: app continues if telemetry is down (default true) */
  failOpen?: boolean;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  offlineQueueMax?: number;
  /** Optional offline queue path (Node only); memory if omitted */
  offlineQueuePath?: string;
  fetchImpl?: typeof fetch;
}

export interface CaptureContext {
  provider: ProviderName | string;
  model: string;
  correlationId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  costUsd?: number;
  costKind?: "estimate" | "exact";
  status?: EventStatus;
  errorCode?: string;
  errorMessage?: string;
  retryCount?: number;
  toolCalls?: ToolCallRecord[];
  agentSteps?: AgentStepRecord[];
  /** Raw content — only stored if privacy allows */
  prompt?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  latencyMs?: number;
}

export interface ProviderCallResult<T = unknown> {
  result: T;
  event: UsageEvent;
}

export interface TransportResult {
  ok: boolean;
  status?: number;
  error?: string;
  /** true when event was queued offline instead of dropped */
  queuedOffline?: boolean;
}
