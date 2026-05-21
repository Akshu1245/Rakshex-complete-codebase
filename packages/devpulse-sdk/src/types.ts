/**
 * Rakshex SDK — Types
 */

export interface RakshexConfig {
  apiKey: string;
  workspaceId: string;
  ingestUrl?: string; // default: https://api.rakshex.in
  sampleRate?: number; // 0.0-1.0, default: 1.0
  redactPII?: boolean; // default: true
  batchSize?: number; // default: 50
  flushIntervalMs?: number; // default: 5000
  maxRetries?: number; // default: 3
  timeoutMs?: number; // default: 10000
}

export interface TelemetryEvent {
  eventId: string;
  workspaceId: string;
  agentId: string;
  userId?: string;
  provider: Provider;
  model: string;
  requestTimestamp: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  status: "ok" | "error" | "timeout" | "blocked";
  redactionCount: number;
  promptHash: string;
  responseHash: string;
  toolCalls: ToolCallRecord[] | null;
  metadata: Record<string, unknown>;
}

export type Provider =
  | "openai"
  | "anthropic"
  | "bedrock"
  | "vertex"
  | "cohere"
  | "mistral"
  | "groq"
  | "ollama"
  | "vllm";

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  latencyMs?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ChatContentBlock[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ChatContentBlock {
  type: "text" | "image_url" | "tool_use" | "tool_result";
  text?: string;
  image_url?: { url: string };
  id?: string;
  name?: string;
  input?: unknown;
  content?: string | ChatContentBlock[];
  tool_use_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

export interface AnthropicResponse {
  id: string;
  model: string;
  content: ChatContentBlock[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}
