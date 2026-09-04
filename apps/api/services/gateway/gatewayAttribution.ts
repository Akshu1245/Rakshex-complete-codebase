import { gatewayCallAttribution } from "@rakshex/database";
import * as db from "../../db";
import { priceModelUsage, type PriceableProvider } from "../billing/modelPriceRegistry";

/** Providers the gateway can settle attribution for. */
export type GatewaySettlementProvider = PriceableProvider | "openai_compatible" | "elevenlabs";

const REGISTRY_PRICEABLE: ReadonlySet<string> = new Set([
  "openai",
  "anthropic",
  "azure_openai",
  "openrouter",
]);

export interface GatewayAttributionTags {
  featureTags?: Record<string, string>;
  customerTags?: Record<string, string>;
}

function cleanTags(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 32);
  const cleaned: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (!/^[A-Za-z0-9._:/-]{1,64}$/.test(key)) continue;
    if (typeof raw !== "string" || raw.length === 0 || raw.length > 128) continue;
    cleaned[key] = raw;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function parseGatewayMetadataHeader(raw: string | undefined): GatewayAttributionTags {
  if (!raw || raw.length > 4096) return {};
  try {
    const decoded = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    return {
      featureTags: cleanTags(decoded.featureTags),
      customerTags: cleanTags(decoded.customerTags),
    };
  } catch {
    return {};
  }
}

export async function persistSettledAttribution(input: {
  requestId: string;
  workspaceId: number;
  projectId?: string;
  agentId?: string;
  identityId?: number;
  providerAccountId: number;
  provider: GatewaySettlementProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  usageVerified: boolean;
  estimatedCostUsd: number;
  /**
   * Cost the provider itself reported for this exact request (e.g. OpenRouter
   * returns `usage.cost` in USD). When present it is the settlement truth and
   * is also persisted as provider_reconciled_cost_usd.
   */
  providerReportedCostUsd?: number;
  /**
   * Deterministic non-registry price (e.g. the Anthropic thinking-token
   * table). Used only when the registry has no version for this model.
   */
  fallbackCostUsd?: number;
  occurredAt: Date;
  tags: GatewayAttributionTags;
  endpoint: string;
}): Promise<{ costUsd: number; priceVersionId?: number; priceSourceUrl?: string }> {
  const providerReported =
    input.providerReportedCostUsd != null &&
    Number.isFinite(input.providerReportedCostUsd) &&
    input.providerReportedCostUsd >= 0
      ? input.providerReportedCostUsd
      : undefined;

  const priced =
    input.usageVerified && REGISTRY_PRICEABLE.has(input.provider)
      ? await priceModelUsage({
          provider: input.provider as PriceableProvider,
          model: input.model,
          occurredAt: input.occurredAt,
          usage: {
            inputTokens: input.inputTokens,
            outputTokens: input.outputTokens,
            cachedInputTokens: input.cachedInputTokens,
          },
        })
      : null;

  const tableFallback =
    input.usageVerified && input.fallbackCostUsd != null && Number.isFinite(input.fallbackCostUsd)
      ? Math.max(0, input.fallbackCostUsd)
      : undefined;

  const costUsd = providerReported ?? priced?.costUsd ?? tableFallback ?? input.estimatedCostUsd;
  const pricingConfidence =
    providerReported != null
      ? "provider_reported"
      : priced
        ? "registry"
        : tableFallback != null
          ? "table_fallback"
          : "estimated_fallback";

  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  await database
    .insert(gatewayCallAttribution)
    .values({
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      agentId: input.agentId,
      identityId: input.identityId,
      providerAccountId: input.providerAccountId,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cachedInputTokens: input.cachedInputTokens,
      estimatedCostUsd: String(input.estimatedCostUsd),
      settledCostUsd: String(costUsd),
      providerReconciledCostUsd: providerReported != null ? String(providerReported) : undefined,
      priceVersionId: priced?.price.id,
      priceSourceUrl: priced?.price.sourceUrl,
      featureTags: input.tags.featureTags,
      customerTags: input.tags.customerTags,
      occurredAt: input.occurredAt,
      metadata: {
        endpoint: input.endpoint,
        pricingConfidence,
      },
    })
    .onConflictDoNothing();

  return {
    costUsd,
    priceVersionId: priced?.price.id,
    priceSourceUrl: priced?.price.sourceUrl,
  };
}
