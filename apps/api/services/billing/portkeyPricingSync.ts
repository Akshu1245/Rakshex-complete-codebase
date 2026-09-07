import { desc, eq } from "drizzle-orm";
import { modelPriceVersions } from "@rakshex/database/schema-pricing";
import * as db from "../../db";
import {
  fetchPortkeyPricing,
  type PortkeyPriceCandidate,
  type PortkeySupportedProvider,
} from "./portkeyPricingSource";

export interface PortkeyPricingSyncResult {
  provider: PortkeySupportedProvider;
  fetched: number;
  unchanged: number;
  inserted: number;
  pending: number;
}

export interface PortkeyPricingSyncOptions {
  providers?: PortkeySupportedProvider[];
  apply?: boolean;
  checkedAt?: Date;
  fetchImpl?: typeof fetch;
}

const DEFAULT_PROVIDERS: PortkeySupportedProvider[] = [
  "openai",
  "anthropic",
  "azure_openai",
  "openrouter",
];

function sameRate(
  current: {
    inputPerMillion: string;
    outputPerMillion: string;
    cachedInputPerMillion: string | null;
  },
  candidate: PortkeyPriceCandidate,
): boolean {
  const eps = 1e-9;
  const cachedCurrent =
    current.cachedInputPerMillion == null ? undefined : Number(current.cachedInputPerMillion);
  const cachedCandidate = candidate.cachedInputPerMillion;
  const cachedSame =
    cachedCurrent == null && cachedCandidate == null
      ? true
      : cachedCurrent != null &&
        cachedCandidate != null &&
        Math.abs(cachedCurrent - cachedCandidate) <= eps;
  return (
    Math.abs(Number(current.inputPerMillion) - candidate.inputPerMillion) <= eps &&
    Math.abs(Number(current.outputPerMillion) - candidate.outputPerMillion) <= eps &&
    cachedSame
  );
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

/**
 * Synchronize changed Portkey model rates into RaksHex's append-only price
 * registry. Dry-run is the default: callers must set apply=true explicitly.
 *
 * The runtime never calls Portkey. Gateway settlement continues to use only
 * RaksHex-local model_price_versions rows and provider-reported cost.
 */
export async function syncPortkeyPricing(
  options: PortkeyPricingSyncOptions = {},
): Promise<PortkeyPricingSyncResult[]> {
  const database = await db.getDb();
  if (!database) throw new Error("Database unavailable");

  const providers = options.providers ?? DEFAULT_PROVIDERS;
  const checkedAt = options.checkedAt ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const results: PortkeyPricingSyncResult[] = [];

  for (const provider of providers) {
    const candidates = await fetchPortkeyPricing(provider, fetchImpl);
    const existing = await database
      .select()
      .from(modelPriceVersions)
      .where(eq(modelPriceVersions.provider, provider))
      .orderBy(desc(modelPriceVersions.effectiveFrom));

    const currentByModel = new Map<string, (typeof existing)[number]>();
    for (const row of existing) {
      if (!currentByModel.has(row.model)) currentByModel.set(row.model, row);
    }

    const changed = candidates.filter((candidate) => {
      const current = currentByModel.get(candidate.model);
      return !current || !sameRate(current, candidate);
    });

    let inserted = 0;
    if (options.apply && changed.length > 0) {
      for (const batch of chunks(changed, 200)) {
        const insertedRows = await database
          .insert(modelPriceVersions)
          .values(
            batch.map((candidate) => ({
              provider: candidate.provider,
              model: candidate.model,
              currency: "usd",
              inputPerMillion: String(candidate.inputPerMillion),
              outputPerMillion: String(candidate.outputPerMillion),
              cachedInputPerMillion:
                candidate.cachedInputPerMillion == null
                  ? null
                  : String(candidate.cachedInputPerMillion),
              effectiveFrom: checkedAt,
              sourceUrl: candidate.sourceUrl,
              sourceCheckedAt: checkedAt,
              metadata: {
                source: "portkey-models",
                importedAt: checkedAt.toISOString(),
                unitConversion: "cents_per_token_x_10000_to_usd_per_million",
              },
            })),
          )
          .onConflictDoNothing()
          .returning({ id: modelPriceVersions.id });
        inserted += insertedRows.length;
      }
    }

    results.push({
      provider,
      fetched: candidates.length,
      unchanged: candidates.length - changed.length,
      inserted,
      pending: options.apply ? Math.max(0, changed.length - inserted) : changed.length,
    });
  }

  return results;
}
