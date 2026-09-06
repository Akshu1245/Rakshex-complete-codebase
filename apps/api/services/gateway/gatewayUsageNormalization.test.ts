import { describe, expect, it } from "vitest";
import { normalizeGatewayUsage, usageEnvelopeMetadata } from "./gatewayUsageNormalization";

describe("gateway usage normalization", () => {
  it("emits a universal envelope for text providers", () => {
    const envelope = normalizeGatewayUsage({
      provider: "openai",
      model: "gpt-4o-mini",
      costUsd: 0.02,
      inputTokens: 100,
      outputTokens: 40,
      confidence: "exact",
    });
    expect(envelope.measurements.some((m) => m.unit === "input_token")).toBe(true);
    expect(usageEnvelopeMetadata(envelope).usageEnvelopeCostUsd).toBe(0.02);
  });

  it("preserves voice character units for ElevenLabs", () => {
    const envelope = normalizeGatewayUsage({
      provider: "elevenlabs",
      product: "tts",
      domain: "voice",
      costUsd: 0.5,
      characters: 2500,
      confidence: "exact",
    });
    expect(envelope.measurements.some((m) => m.unit === "credit" && m.quantity === 2500)).toBe(
      true,
    );
    expect(envelope.provider).toBe("elevenlabs");
  });
});
