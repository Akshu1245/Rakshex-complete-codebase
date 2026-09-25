/**
 * Versioned per-model price table used by the pre-request gate.
 *
 * Honesty contract (non-negotiable):
 * - Every entry here is labeled "estimated", including the ones that happen
 *   to match a provider's public price list. Provider pricing changes without
 *   notice, includes unpriced tiers (cached input, batch, priority), and
 *   differs by region/contract. This table is a worst-case gate input, not a
 *   billing source. NEVER present its outputs as exact or use them to
 *   reprice historical calls.
 * - The authoritative versioned registry (where maintained) is the
 *   `model_price_versions` table in @rakshex/database; this in-memory table
 *   is the fail-safe default the pure gate can use without a DB round-trip.
 * - Lookup is exact (provider, model). Unknown models throw at estimate time
 *   so the gate DENYs fail-closed instead of guessing a rate.
 */
import type { SignalLabel } from "./labels";

export interface ModelPriceEntry {
  provider: string;
  model: string;
  /** USD per 1M input tokens. */
  inputPerMillionUsd: number;
  /** USD per 1M output tokens. */
  outputPerMillionUsd: number;
  /** ISO date the entry became effective. */
  effectiveFrom: string;
  /** Always "estimated" — see the contract above. */
  signalLabel: Extract<SignalLabel, "estimated">;
}

/** Bump when entries change; receipts record the version they were estimated with. */
export const PRICE_TABLE_VERSION = "2026-09-25";

export const MODEL_PRICE_TABLE: readonly ModelPriceEntry[] = [
  { provider: "openai", model: "gpt-4o", inputPerMillionUsd: 2.5, outputPerMillionUsd: 10, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "openai", model: "gpt-4o-mini", inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "openai", model: "gpt-5", inputPerMillionUsd: 1.25, outputPerMillionUsd: 10, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "openai", model: "gpt-5-mini", inputPerMillionUsd: 0.25, outputPerMillionUsd: 2, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "openai", model: "gpt-5-nano", inputPerMillionUsd: 0.05, outputPerMillionUsd: 0.4, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "anthropic", model: "claude-sonnet-4", inputPerMillionUsd: 3, outputPerMillionUsd: 15, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "anthropic", model: "claude-haiku-4", inputPerMillionUsd: 1, outputPerMillionUsd: 5, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "google", model: "gemini-2.5-pro", inputPerMillionUsd: 1.25, outputPerMillionUsd: 10, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "google", model: "gemini-2.5-flash", inputPerMillionUsd: 0.3, outputPerMillionUsd: 2.5, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "google", model: "gemini-2.5-flash-lite", inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "deepseek", model: "deepseek-chat", inputPerMillionUsd: 0.27, outputPerMillionUsd: 1.1, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
  { provider: "xai", model: "grok-4", inputPerMillionUsd: 3, outputPerMillionUsd: 15, effectiveFrom: "2026-09-25", signalLabel: "estimated" },
];

/** Exact (provider, model) lookup, case-insensitive. Returns undefined for unknown models. */
export function lookupModelPrice(
  provider: string,
  model: string,
): ModelPriceEntry | undefined {
  const p = provider.trim().toLowerCase();
  const m = model.trim().toLowerCase();
  return MODEL_PRICE_TABLE.find(
    (entry) => entry.provider === p && entry.model === m,
  );
}
