/**
 * @rakshex/agentguard-sdk — runtime SDK for LLM telemetry and governance.
 *
 * Privacy: does not capture prompt content by default (metadata_only).
 * Resilience: fail-open when telemetry is unavailable; offline queue + retry.
 * Security: never accepts or forwards provider API keys to the gateway.
 */

export type {
  AgentGuardClientOptions,
  AgentStepRecord,
  CaptureContext,
  EventStatus,
  PrivacyMode,
  ProviderCallResult,
  ProviderName,
  ToolCallRecord,
  TransportResult,
  UsageEvent,
} from "./types.js";

export { AgentGuardClient, createAgentGuardClient, SDK_NAME, SDK_VERSION } from "./client.js";

export { applyPrivacy, looksLikeProviderKey, redactSecrets, scrubMetadataKeys } from "./privacy.js";

export { OfflineQueue } from "./offline-queue.js";
export { sendBatch } from "./transport.js";
export { sha256Hex, randomId } from "./hash.js";

export {
  wrapOpenAI,
  wrapAnthropic,
  wrapGemini,
  wrapAzureOpenAI,
  wrapBedrock,
  wrapOpenRouter,
  instrumentProviderCall,
} from "./providers/index.js";
export type { WrapOptions } from "./providers/index.js";
