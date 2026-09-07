/**
 * Portkey Models import adapter.
 *
 * Portkey publishes prices in cents per token. RaksHex stores USD per 1M
 * tokens, therefore: cents/token * (1 USD / 100 cents) * 1,000,000
 * = price * 10,000 USD per 1M tokens.
 *
 * This module is deliberately pure: it does not write to the database and it
 * never runs on the request path. A separate sync job can validate candidates
 * before adding a new append-only model_price_versions row.
 */

export const PORTKEY_PRICING_BASE = "https://configs.portkey.ai/pricing";

export const PORTKEY_PROVIDER_SLUGS = {
  openai: "openai",
  anthropic: "anthropic",
  azure_openai: "azure-openai",
  openrouter: "openrouter",
} as const;

export type PortkeySupportedProvider = keyof typeof PORTKEY_PROVIDER_SLUGS;

interface PortkeyUnitPrice {
  price?: unknown;
}

interface PortkeyPayAsYouGo {
  request_token?: PortkeyUnitPrice;
  response_token?: PortkeyUnitPrice;
  cache_read_input_token?: PortkeyUnitPrice;
}

interface PortkeyModelEntry {
  pricing_config?: {
    pay_as_you_go?: PortkeyPayAsYouGo;
    currency?: unknown;
  };
}

export interface PortkeyPriceCandidate {
  provider: PortkeySupportedProvider;
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
  sourceUrl: string;
}

function finiteNonNegative(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function centsPerTokenToUsdPerMillion(price: number): number {
  return price * 10_000;
}

export function parsePortkeyPricing(
  provider: PortkeySupportedProvider,
  payload: unknown,
  sourceUrl = `${PORTKEY_PRICING_BASE}/${PORTKEY_PROVIDER_SLUGS[provider]}.json`,
): PortkeyPriceCandidate[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const candidates: PortkeyPriceCandidate[] = [];
  for (const [model, raw] of Object.entries(payload as Record<string, unknown>)) {
    if (model === "default" || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as PortkeyModelEntry;
    const payg = entry.pricing_config?.pay_as_you_go;
    if (!payg) continue;

    const input = finiteNonNegative(payg.request_token?.price);
    const output = finiteNonNegative(payg.response_token?.price);
    if (input == null || output == null) continue;

    const cached = finiteNonNegative(payg.cache_read_input_token?.price);
    candidates.push({
      provider,
      model,
      inputPerMillion: centsPerTokenToUsdPerMillion(input),
      outputPerMillion: centsPerTokenToUsdPerMillion(output),
      ...(cached == null
        ? {}
        : { cachedInputPerMillion: centsPerTokenToUsdPerMillion(cached) }),
      sourceUrl,
    });
  }

  return candidates.sort((a, b) => a.model.localeCompare(b.model));
}

export async function fetchPortkeyPricing(
  provider: PortkeySupportedProvider,
  fetchImpl: typeof fetch = fetch,
): Promise<PortkeyPriceCandidate[]> {
  const sourceUrl = `${PORTKEY_PRICING_BASE}/${PORTKEY_PROVIDER_SLUGS[provider]}.json`;
  const response = await fetchImpl(sourceUrl, {
    headers: { accept: "application/json", "user-agent": "RaksHex-Pricing-Sync/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Portkey pricing fetch failed for ${provider}: HTTP ${response.status}`);
  }
  return parsePortkeyPricing(provider, await response.json(), sourceUrl);
}
