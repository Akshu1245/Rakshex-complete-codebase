import {
  buildUsageEnvelope,
  totalCostUsd,
  type ProviderUsageEnvelope,
  type UsageDomain,
} from "../teamGovernance/usageUnits";

export interface GatewayNormalizedUsageInput {
  provider: string;
  model?: string;
  product?: string;
  domain?: UsageDomain;
  costUsd: number;
  requestCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Voice providers: characters billed (ElevenLabs). */
  characters?: number;
  audioSeconds?: number;
  confidence?: "exact" | "estimated" | "imported" | "unknown";
}

/**
 * Produce the cross-provider usage envelope every gateway settlement should
 * emit. Financial control remains USD-first; non-token units are preserved
 * alongside tokens rather than collapsed into fake token counts.
 */
export function normalizeGatewayUsage(input: GatewayNormalizedUsageInput): ProviderUsageEnvelope {
  const domain =
    input.domain ??
    (input.characters != null || input.audioSeconds != null
      ? "voice"
      : input.inputTokens != null || input.outputTokens != null
        ? "text"
        : "generic_api");

  return buildUsageEnvelope({
    provider: input.provider,
    model: input.model,
    product: input.product,
    domain,
    costUsd: input.costUsd,
    requestCount: input.requestCount ?? 1,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    credits: input.characters,
    audioSeconds: input.audioSeconds,
    confidence: input.confidence ?? "exact",
  });
}

/** Attach the normalized envelope to team_ai_usage_events.metadata for analytics. */
export function usageEnvelopeMetadata(envelope: ProviderUsageEnvelope): Record<string, unknown> {
  return {
    usageEnvelope: envelope,
    usageEnvelopeCostUsd: totalCostUsd(envelope),
  };
}
