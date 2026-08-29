import { describe, expect, it } from "vitest";
import { buildUsageEnvelope, totalCostUsd } from "./usageUnits";

describe("usage unit normalization", () => {
  it("keeps text token dimensions and money separate", () => {
    const event = buildUsageEnvelope({
      provider: "openai",
      model: "gpt-example",
      domain: "text",
      requestCount: 1,
      inputTokens: 1200,
      outputTokens: 300,
      costUsd: 0.04,
    });

    expect(event.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unit: "request", quantity: 1 }),
        expect.objectContaining({ unit: "input_token", quantity: 1200 }),
        expect.objectContaining({ unit: "output_token", quantity: 300 }),
        expect.objectContaining({ unit: "usd", quantity: 0.04 }),
      ]),
    );
    expect(totalCostUsd(event)).toBe(0.04);
  });

  it("supports voice providers without pretending usage is tokens", () => {
    const event = buildUsageEnvelope({
      provider: "elevenlabs",
      product: "tts",
      domain: "voice",
      audioSeconds: 95,
      credits: 320,
      costUsd: 0.7,
    });

    expect(event.measurements.some((m) => m.unit === "audio_second" && m.quantity === 95)).toBe(true);
    expect(event.measurements.some((m) => m.unit === "credit" && m.quantity === 320)).toBe(true);
    expect(event.measurements.some((m) => m.unit.includes("token"))).toBe(false);
  });

  it("supports image and video capacity in the same common envelope", () => {
    const image = buildUsageEnvelope({
      provider: "image-provider",
      domain: "image",
      images: 4,
      costUsd: 0.16,
    });
    const video = buildUsageEnvelope({
      provider: "video-provider",
      domain: "video",
      videoSeconds: 12,
      costUsd: 0.9,
    });

    expect(image.measurements).toContainEqual(
      expect.objectContaining({ domain: "image", unit: "image", quantity: 4 }),
    );
    expect(video.measurements).toContainEqual(
      expect.objectContaining({ domain: "video", unit: "video_second", quantity: 12 }),
    );
  });

  it("drops invalid negative or non-finite measurements", () => {
    const event = buildUsageEnvelope({
      provider: "bad-input",
      domain: "generic_api",
      requestCount: -2,
      bytes: Number.POSITIVE_INFINITY,
      costUsd: Number.NaN,
    });

    expect(event.measurements).toEqual([]);
  });
});
