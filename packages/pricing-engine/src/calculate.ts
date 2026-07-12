import { FX_TO_USD, PRICING_CATALOG, type CostKind, type PricingVersion } from "./catalog.js";

export interface TokenUsageInput {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  toolCalls?: number;
  searches?: number;
  isBatch?: boolean;
  fineTuneTokens?: number;
  region?: string;
  /** ISO date for historical pricing lookup */
  asOf?: string;
  /** Enterprise override rows take precedence */
  enterpriseOverrides?: PricingVersion[];
  currency?: string;
}

export interface CostRecord {
  kind: CostKind;
  currency: string;
  amount: number;
  amountUsd: number;
  pricingVersionId: string;
  breakdown: {
    input: number;
    output: number;
    cached: number;
    reasoning: number;
    tools: number;
    search: number;
    batch: number;
    fineTune: number;
  };
  notes: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function dateOnOrAfter(iso: string, from: string): boolean {
  return iso.slice(0, 10) >= from;
}

function dateBefore(iso: string, to: string | null): boolean {
  if (!to) return true;
  return iso.slice(0, 10) < to;
}

/**
 * Resolve the pricing version in effect for provider/model at asOf.
 * Prefers exact model match, then wildcard. Enterprise overrides win.
 */
export function resolvePricingVersion(
  usage: Pick<TokenUsageInput, "provider" | "model" | "asOf" | "region" | "enterpriseOverrides">,
  catalog: PricingVersion[] = PRICING_CATALOG,
): PricingVersion | null {
  const asOf = (usage.asOf ?? new Date().toISOString()).slice(0, 10);
  const provider = normalize(usage.provider);
  const model = normalize(usage.model);
  const pool = [...(usage.enterpriseOverrides ?? []), ...catalog];

  const candidates = pool.filter((p) => {
    if (normalize(p.provider) !== provider) return false;
    if (!dateOnOrAfter(asOf, p.effectiveFrom)) return false;
    if (!dateBefore(asOf, p.effectiveTo)) return false;
    if (usage.region && p.region && normalize(p.region) !== normalize(usage.region)) return false;
    const pm = normalize(p.model);
    return pm === model || pm === "*" || model.includes(pm) || pm.includes(model);
  });

  if (candidates.length === 0) return null;

  // Prefer exact model, enterprise, closed historical windows, then latest effectiveFrom
  candidates.sort((a, b) => {
    const exactA = normalize(a.model) === model ? 1 : 0;
    const exactB = normalize(b.model) === model ? 1 : 0;
    if (exactA !== exactB) return exactB - exactA;
    if (!!a.enterpriseOverride !== !!b.enterpriseOverride) {
      return a.enterpriseOverride ? -1 : 1;
    }
    // Prefer finite effectiveTo windows when they cover asOf (historical stability)
    if (!!a.effectiveTo !== !!b.effectiveTo) {
      return a.effectiveTo ? -1 : 1;
    }
    return b.effectiveFrom.localeCompare(a.effectiveFrom);
  });

  return candidates[0] ?? null;
}

export function calculateCost(
  usage: TokenUsageInput,
  catalog: PricingVersion[] = PRICING_CATALOG,
): CostRecord {
  const notes: string[] = [];
  const version = resolvePricingVersion(usage, catalog);

  if (!version) {
    notes.push("No pricing version found; amount is estimated as 0");
    notes.push("Mark as estimate — do not treat as confirmed bill");
    return {
      kind: "estimate",
      currency: usage.currency ?? "USD",
      amount: 0,
      amountUsd: 0,
      pricingVersionId: "none",
      breakdown: {
        input: 0,
        output: 0,
        cached: 0,
        reasoning: 0,
        tools: 0,
        search: 0,
        batch: 0,
        fineTune: 0,
      },
      notes,
    };
  }

  const perM = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
  const cached = usage.cachedInputTokens ?? 0;
  const nonCachedInput = Math.max(0, usage.inputTokens - cached);

  const input = perM(nonCachedInput, version.inputPer1M);
  const cachedCost = perM(cached, version.cachedInputPer1M ?? version.inputPer1M);
  const output = perM(usage.outputTokens, version.outputPer1M);
  const reasoning = perM(usage.reasoningTokens ?? 0, version.reasoningPer1M ?? 0);
  const tools = ((usage.toolCalls ?? 0) / 1000) * (version.toolCallPer1K ?? 0);
  const search = ((usage.searches ?? 0) / 1000) * (version.searchPer1K ?? 0);
  const fineTune = perM(usage.fineTuneTokens ?? 0, version.fineTunePer1M ?? 0);

  let subtotal = input + cachedCost + output + reasoning + tools + search + fineTune;
  let batchAdj = 0;
  if (usage.isBatch && version.batchDiscount) {
    batchAdj = -subtotal * version.batchDiscount;
    subtotal += batchAdj;
  }

  const amountUsd = Number(subtotal.toFixed(8));
  const currency = usage.currency ?? "USD";
  const fx = FX_TO_USD[currency] ?? 1;
  // Convert USD → currency if not USD (catalog is USD)
  const amount = currency === "USD" ? amountUsd : Number((amountUsd / fx).toFixed(8));

  // Catalog-based calculations are estimates unless provider reports exact cost
  const kind: CostKind = "estimate";
  notes.push(`Pricing version ${version.id}`);
  notes.push("kind=estimate — not a provider invoice");

  return {
    kind,
    currency,
    amount,
    amountUsd,
    pricingVersionId: version.id,
    breakdown: {
      input: Number(input.toFixed(8)),
      output: Number(output.toFixed(8)),
      cached: Number(cachedCost.toFixed(8)),
      reasoning: Number(reasoning.toFixed(8)),
      tools: Number(tools.toFixed(8)),
      search: Number(search.toFixed(8)),
      batch: Number(batchAdj.toFixed(8)),
      fineTune: Number(fineTune.toFixed(8)),
    },
    notes,
  };
}

/** Label a provider-reported cost as exact while still binding a pricing version id when known. */
export function labelExactCost(
  amountUsd: number,
  pricingVersionId: string | null,
  currency = "USD",
): CostRecord {
  return {
    kind: "exact",
    currency,
    amount: amountUsd,
    amountUsd,
    pricingVersionId: pricingVersionId ?? "provider_reported",
    breakdown: {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      tools: 0,
      search: 0,
      batch: 0,
      fineTune: 0,
    },
    notes: ["kind=exact — provider-reported cost"],
  };
}

export function listPricingVersions(catalog: PricingVersion[] = PRICING_CATALOG): PricingVersion[] {
  return [...catalog];
}

/**
 * Forecast remaining-period cost from daily burn rate.
 */
export function forecastSpend(
  spendToDateUsd: number,
  daysElapsed: number,
  periodDays: number,
): { projectedUsd: number; dailyBurn: number; daysRemaining: number } {
  if (daysElapsed <= 0) {
    return { projectedUsd: spendToDateUsd, dailyBurn: 0, daysRemaining: periodDays };
  }
  const dailyBurn = spendToDateUsd / daysElapsed;
  const daysRemaining = Math.max(0, periodDays - daysElapsed);
  return {
    projectedUsd: Number((spendToDateUsd + dailyBurn * daysRemaining).toFixed(4)),
    dailyBurn: Number(dailyBurn.toFixed(6)),
    daysRemaining,
  };
}

export interface OptimizationHint {
  code: string;
  message: string;
  estimatedSavingsUsd?: number;
}

export function recommendOptimizations(
  usage: TokenUsageInput,
  cost: CostRecord,
): OptimizationHint[] {
  const hints: OptimizationHint[] = [];
  if (usage.inputTokens > 0 && (usage.cachedInputTokens ?? 0) / usage.inputTokens < 0.1) {
    hints.push({
      code: "enable_prompt_cache",
      message: "Low cache hit rate — enable prompt caching where supported",
      estimatedSavingsUsd: cost.breakdown.input * 0.3,
    });
  }
  if (!usage.isBatch && usage.inputTokens + usage.outputTokens > 100_000) {
    hints.push({
      code: "batch_api",
      message: "Large offline workloads may be cheaper with batch APIs",
    });
  }
  if (normalize(usage.model).includes("opus") || normalize(usage.model).includes("gpt-4o")) {
    hints.push({
      code: "model_tier",
      message: "Consider a smaller model for non-critical steps",
    });
  }
  return hints;
}
