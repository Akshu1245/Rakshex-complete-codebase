export type RakshexOpenAIProvider = "openai" | "openai_compatible";

export interface RakshexOpenAIOptions {
  /** Rakshex workspace API key. Defaults to RAKSHEX_API_KEY. */
  apiKey?: string;
  /** Rakshex gateway origin/base URL. Defaults to RAKSHEX_GATEWAY_URL. */
  gatewayUrl?: string;
  /** Upstream provider selected by the Rakshex gateway. */
  provider?: RakshexOpenAIProvider;
  /** Optional identity attribution header. */
  identityId?: number;
  /** Optional project attribution header. */
  projectId?: string;
  /** Optional autonomous-agent attribution header. */
  agentId?: string;
  /** Optional centrally managed provider account to use. */
  providerAccountId?: number;
  /** Additional headers to pass through to the Rakshex gateway. */
  defaultHeaders?: Record<string, string>;
}

export interface OpenAICompatibleConstructor<TClient> {
  new (options: {
    apiKey: string;
    baseURL: string;
    defaultHeaders?: Record<string, string>;
  }): TClient;
}

function environment(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name];
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required`);
  }
  return normalized;
}

/**
 * OpenAI SDK baseURL must include /v1 so supported official-client routes
 * land on the Rakshex OpenAI-compatible gateway. Chat Completions and the
 * synchronous/streaming Responses API share the same governed path.
 */
export function normalizeRakshexGatewayUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) throw new Error("RAKSHEX_GATEWAY_URL is required");
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

/**
 * Configure the customer's existing official OpenAI client to route through
 * Rakshex. Rakshex receives the workspace key; the upstream OpenAI credential
 * remains centrally managed by the gateway and is never placed in agent code.
 *
 * Example:
 *   import OpenAI from "openai";
 *   import { createRakshexOpenAI } from "@rakshex/sdk";
 *   const openai = createRakshexOpenAI(OpenAI, { agentId: "refund-agent" });
 */
export function createRakshexOpenAI<TClient>(
  OpenAIClient: OpenAICompatibleConstructor<TClient>,
  options: RakshexOpenAIOptions = {},
): TClient {
  const apiKey = required(options.apiKey ?? environment("RAKSHEX_API_KEY"), "RAKSHEX_API_KEY");
  const baseURL = normalizeRakshexGatewayUrl(
    required(options.gatewayUrl ?? environment("RAKSHEX_GATEWAY_URL"), "RAKSHEX_GATEWAY_URL"),
  );

  const defaultHeaders: Record<string, string> = {
    ...options.defaultHeaders,
    "x-rakshex-provider": options.provider ?? "openai",
  };

  if (options.identityId != null) {
    defaultHeaders["x-rakshex-identity-id"] = String(options.identityId);
  }
  if (options.projectId) {
    defaultHeaders["x-rakshex-project-id"] = options.projectId;
  }
  if (options.agentId) {
    defaultHeaders["x-rakshex-agent-id"] = options.agentId;
  }
  if (options.providerAccountId != null) {
    defaultHeaders["x-rakshex-provider-account-id"] = String(options.providerAccountId);
  }

  return new OpenAIClient({
    apiKey,
    baseURL,
    defaultHeaders,
  });
}
