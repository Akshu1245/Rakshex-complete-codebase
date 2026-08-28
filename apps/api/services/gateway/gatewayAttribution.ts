import { gatewayCallAttribution } from "@rakshex/database";
import * as db from "../../db";
import { priceModelUsage } from "../billing/modelPriceRegistry";

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
  provider: "openai" | "openai_compatible";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimatedCostUsd: number;
  occurredAt: Date;
  tags: GatewayAttributionTags;
  endpoint: string;
}): Promise<{ costUsd: number; priceVersionId?: number; priceSourceUrl?: string }> {
  const priced =
    input.provider === "openai"
      ? await priceModelUsage({
          provider: "openai",
          model: input.model,
          occurredAt: input.occurredAt,
          usage: {
            inputTokens: input.inputTokens,
            outputTokens: input.outputTokens,
            cachedInputTokens: input.cachedInputTokens,
          },
        })
      : null;
  const costUsd = priced?.costUsd ?? input.estimatedCostUsd;

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
      priceVersionId: priced?.price.id,
      priceSourceUrl: priced?.price.sourceUrl,
      featureTags: input.tags.featureTags,
      customerTags: input.tags.customerTags,
      occurredAt: input.occurredAt,
      metadata: {
        endpoint: input.endpoint,
        pricingConfidence: priced ? "registry" : "estimated_fallback",
      },
    })
    .onConflictDoNothing();

  return {
    costUsd,
    priceVersionId: priced?.price.id,
    priceSourceUrl: priced?.price.sourceUrl,
  };
}
