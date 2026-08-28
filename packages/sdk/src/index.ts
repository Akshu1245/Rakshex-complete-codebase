/**
 * @rakshex/sdk — the Rakshex runtime SDK.
 *
 * Two clients live here, deliberately kept in one package rather than two,
 * because most integrators need both:
 *
 *   - AgentGuardClient   — LLM telemetry, PII/secret redaction, privacy
 *     modes, provider wrappers (OpenAI/Anthropic/Gemini/Azure/Bedrock/
 *     OpenRouter). Does not capture prompt content by default
 *     (metadata_only). Fail-open when telemetry is unavailable, with an
 *     offline queue + retry. Never accepts or forwards provider API keys.
 *
 *   - AgentFirewallClient — the Agent Firewall client: evaluate() before an
 *     autonomous action runs, executeWithCredential()/authorizeAndRun() to
 *     have Rakshex broker or gate the call itself, recordOutcome() to close
 *     the loop. This is the product's headline feature ("competitors govern
 *     the session, Rakshex governs the action") — see agentFirewall.ts on
 *     the server and docs/POLICY_ENGINE_UNIFICATION.md for the decision
 *     engine behind it.
 *
 * This package was originally published as @rakshex/agentguard-sdk before
 * the Firewall client was added into it (2026-08-09 unification: previously
 * three unrelated things all answered to "AgentGuard" — this scanning-vs-
 * governance-vs-firewall confusion is documented in CLAUDE.md). Renamed to
 * @rakshex/sdk because a package that ships both clients shouldn't be named
 * after only one of them. No Python equivalent of AgentFirewallClient
 * exists yet — rakshex-agentguard (PyPI) still only covers the AgentGuard
 * half; that gap is real and not yet closed.
 */

export type {
  AgentGuardClientOptions,
  AgentStepRecord,
  CaptureContext,
  EventStatus,
  GatewayChatCompletionOptions,
  GatewayChatCompletionRequest,
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

export {
  createRakshexOpenAI,
  normalizeRakshexGatewayUrl,
} from "./openaiGateway.js";
export type {
  OpenAICompatibleConstructor,
  RakshexOpenAIOptions,
  RakshexOpenAIProvider,
} from "./openaiGateway.js";

export { AgentFirewallClient, FirewallDeniedError, createAgentFirewallClient } from "./firewall.js";
export type {
  BrokeredResponse,
  FirewallAction,
  FirewallClientOptions,
  FirewallDecision,
} from "./firewall.js";
