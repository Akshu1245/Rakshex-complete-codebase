/**
 * @rakshex/agentguard-sdk — public SDK surface (foundation scaffold).
 *
 * TODO(product): implement provider wrappers (OpenAI, Anthropic, etc.),
 * privacy modes, and gateway transport. Existing server-side AgentGuard
 * logic remains under apps/api until extracted.
 */

export type PrivacyMode =
  "metadata_only" | "redacted_content" | "full_content" | "local_only" | "zero_retention";

export interface AgentGuardClientOptions {
  apiKey: string;
  gatewayUrl?: string;
  privacyMode?: PrivacyMode;
  workspaceId?: string;
}

export interface AgentGuardClient {
  readonly options: AgentGuardClientOptions;
  /** TODO(product): wrap provider clients */
  isConfigured(): boolean;
}

/**
 * Compile-safe factory. Does not call network or invent runtime behavior.
 */
export function createAgentGuardClient(options: AgentGuardClientOptions): AgentGuardClient {
  return {
    options: {
      privacyMode: "metadata_only",
      ...options,
    },
    isConfigured() {
      return Boolean(options.apiKey);
    },
  };
}

export const SDK_NAME = "@rakshex/agentguard-sdk" as const;
export const SDK_VERSION = "0.1.0" as const;
