import { and, desc, eq, lte } from "drizzle-orm";
import { modelPriceVersions, type ModelPriceVersion } from "@rakshex/database/schema-pricing";
import * as db from "../../db";

export interface PriceableUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface PriceRate {
  id?: number;
  provider: string;
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number | null;
  effectiveFrom: Date;
  sourceUrl: string;
}

export function selectEffectivePrice<T extends { effectiveFrom: Date }>(
  versions: readonly T[],
  occurredAt: Date,
): T | undefined {
  return [...versions]
    .filter((version) => version.effectiveFrom.getTime() <= occurredAt.getTime())
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
}

export function calculatePrice(rate: PriceRate, usage: PriceableUsage): number {
  const cached = Math.min(Math.max(0, usage.cachedInputTokens ?? 0), Math.max(0, usage.inputTokens));
  const uncached = Math.max(0, usage.inputTokens - cached);
  const cachedRate = rate.cachedInputPerMillion ?? rate.inputPerMillion;
  return (
    (uncached * rate.inputPerMillion + cached * cachedRate + usage.outputTokens * rate.outputPerMillion) /
    1_000_000
  );
}

function toRate(row: ModelPriceVersion): PriceRate {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPerMillion: Number(row.inputPerMillion),
    outputPerMillion: Number(row.outputPerMillion),
    cachedInputPerMillion:
      row.cachedInputPerMillion == null ? null : Number(row.cachedInputPerMillion),
    effectiveFrom: row.effectiveFrom,
    sourceUrl: row.sourceUrl,
  };
}

export async function lookupModelPrice(input: {
  provider: "openai" | "anthropic";
  model: string;
  occurredAt: Date;
}): Promise<PriceRate | null> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");
  const [row] = await database
    .select()
    .from(modelPriceVersions)
    .where(
      and(
        eq(modelPriceVersions.provider, input.provider),
        eq(modelPriceVersions.model, input.model),
        lte(modelPriceVersions.effectiveFrom, input.occurredAt),
      ),
    )
    .orderBy(desc(modelPriceVersions.effectiveFrom))
    .limit(1);
  return row ? toRate(row) : null;
}

export async function priceModelUsage(input: {
  provider: "openai" | "anthropic";
  model: string;
  occurredAt: Date;
  usage: PriceableUsage;
}): Promise<{ costUsd: number; price: PriceRate } | null> {
  const price = await lookupModelPrice(input);
  if (!price) return null;
  return { costUsd: calculatePrice(price, input.usage), price };
}
