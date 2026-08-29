export type UsageUnit =
  | "usd"
  | "request"
  | "input_token"
  | "output_token"
  | "credit"
  | "image"
  | "audio_second"
  | "video_second"
  | "gpu_second"
  | "byte"
  | "completion";

export type UsageDomain =
  | "text"
  | "code"
  | "voice"
  | "image"
  | "video"
  | "cloud"
  | "generic_api";

export interface UsageMeasurement {
  domain: UsageDomain;
  unit: UsageUnit;
  quantity: number;
  /** Optional normalized financial value. Money remains the primary cross-provider budget unit. */
  costUsd?: number;
  /** exact = provider/runtime returned; estimated = price-table derived; imported = admin/billing import. */
  confidence: "exact" | "estimated" | "imported" | "unknown";
}

export interface ProviderUsageEnvelope {
  provider: string;
  product?: string;
  model?: string;
  measurements: UsageMeasurement[];
}

function finiteNonNegative(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/**
 * Normalize common AI/API usage shapes without pretending tokens are universal.
 * Callers may add provider-specific measurements (credits, image count, seconds,
 * bandwidth) while financial spend remains the common control-plane unit.
 */
export function buildUsageEnvelope(input: {
  provider: string;
  product?: string;
  model?: string;
  domain: UsageDomain;
  costUsd?: number;
  requestCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  credits?: number;
  images?: number;
  audioSeconds?: number;
  videoSeconds?: number;
  gpuSeconds?: number;
  bytes?: number;
  completions?: number;
  confidence?: UsageMeasurement["confidence"];
}): ProviderUsageEnvelope {
  const confidence = input.confidence ?? "exact";
  const measurements: UsageMeasurement[] = [];

  const push = (unit: UsageUnit, quantity: number | undefined) => {
    const normalized = finiteNonNegative(quantity);
    if (normalized == null || normalized === 0) return;
    measurements.push({ domain: input.domain, unit, quantity: normalized, confidence });
  };

  push("request", input.requestCount);
  push("input_token", input.inputTokens);
  push("output_token", input.outputTokens);
  push("credit", input.credits);
  push("image", input.images);
  push("audio_second", input.audioSeconds);
  push("video_second", input.videoSeconds);
  push("gpu_second", input.gpuSeconds);
  push("byte", input.bytes);
  push("completion", input.completions);

  const costUsd = finiteNonNegative(input.costUsd);
  if (costUsd != null && costUsd > 0) {
    measurements.push({
      domain: input.domain,
      unit: "usd",
      quantity: costUsd,
      costUsd,
      confidence,
    });
  }

  return {
    provider: input.provider,
    product: input.product,
    model: input.model,
    measurements,
  };
}

export function totalCostUsd(envelope: ProviderUsageEnvelope): number {
  const total = envelope.measurements
    .filter((m) => m.unit === "usd")
    .reduce((sum, m) => sum + m.quantity, 0);
  return Math.round(total * 1_000_000) / 1_000_000;
}
