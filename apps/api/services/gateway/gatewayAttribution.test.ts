import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), priceModelUsage: vi.fn() }));
vi.mock("@rakshex/database", () => ({ gatewayCallAttribution: {} }));
vi.mock("../../db", () => ({ getDb: mocks.getDb }));
vi.mock("../billing/modelPriceRegistry", () => ({ priceModelUsage: mocks.priceModelUsage }));
import { persistSettledAttribution, parseGatewayMetadataHeader } from "./gatewayAttribution";

describe("gateway attribution settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({
      insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }),
    });
  });

  it("keeps the conservative reservation when provider usage is missing", async () => {
    mocks.priceModelUsage.mockResolvedValue({
      costUsd: 0,
      price: { id: 99, sourceUrl: "https://example.invalid/price" },
    });
    const result = await persistSettledAttribution({
      requestId: "server-id",
      workspaceId: 42,
      providerAccountId: 8,
      provider: "openai",
      model: "gpt-5",
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      usageVerified: false,
      estimatedCostUsd: 0.031,
      occurredAt: new Date("2026-08-28T00:00:00Z"),
      tags: {},
      endpoint: "responses",
    });
    expect(mocks.priceModelUsage).not.toHaveBeenCalled();
    expect(result.costUsd).toBe(0.031);
  });

  const settledInput = {
    requestId: "server-id",
    workspaceId: 42,
    providerAccountId: 8,
    model: "some-model",
    inputTokens: 100,
    outputTokens: 50,
    cachedInputTokens: 0,
    usageVerified: true,
    estimatedCostUsd: 0.5,
    occurredAt: new Date("2026-08-28T00:00:00Z"),
    tags: {},
    endpoint: "chat/completions",
  } as const;

  it("prefers provider-reported cost over the registry", async () => {
    mocks.priceModelUsage.mockResolvedValue({
      costUsd: 0.2,
      price: { id: 99, sourceUrl: "https://example.invalid/price" },
    });
    const result = await persistSettledAttribution({
      ...settledInput,
      provider: "openrouter",
      providerReportedCostUsd: 0.00073,
    });
    expect(result.costUsd).toBe(0.00073);
  });

  it("prices verified Anthropic usage from the registry before the table fallback", async () => {
    mocks.priceModelUsage.mockResolvedValue({
      costUsd: 0.0123,
      price: { id: 7, sourceUrl: "https://example.invalid/anthropic" },
    });
    const result = await persistSettledAttribution({
      ...settledInput,
      provider: "anthropic",
      fallbackCostUsd: 0.9,
    });
    expect(mocks.priceModelUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "anthropic", model: "some-model" }),
    );
    expect(result.costUsd).toBe(0.0123);
    expect(result.priceVersionId).toBe(7);
  });

  it("uses the deterministic table fallback when the registry has no version", async () => {
    mocks.priceModelUsage.mockResolvedValue(null);
    const result = await persistSettledAttribution({
      ...settledInput,
      provider: "anthropic",
      fallbackCostUsd: 0.0088,
    });
    expect(result.costUsd).toBe(0.0088);
    expect(result.priceVersionId).toBeUndefined();
  });

  it("falls back to the conservative estimate for unpriced Azure usage", async () => {
    mocks.priceModelUsage.mockResolvedValue(null);
    const result = await persistSettledAttribution({
      ...settledInput,
      provider: "azure_openai",
    });
    expect(mocks.priceModelUsage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "azure_openai" }),
    );
    expect(result.costUsd).toBe(0.5);
  });

  it("ignores invalid provider-reported costs", async () => {
    mocks.priceModelUsage.mockResolvedValue(null);
    const result = await persistSettledAttribution({
      ...settledInput,
      provider: "openrouter",
      providerReportedCostUsd: Number.NaN,
    });
    expect(result.costUsd).toBe(0.5);
  });

  it("parses bounded feature and customer tags and drops oversized or secret-like values", () => {
    const encoded = encodeURIComponent(
      JSON.stringify({
        featureTags: { surface: "refunds" },
        customerTags: { team: "payments", note: "" },
        ignored: { nested: true },
      }),
    );
    expect(parseGatewayMetadataHeader(encoded)).toEqual({
      featureTags: { surface: "refunds" },
      customerTags: { team: "payments" },
    });
    expect(parseGatewayMetadataHeader("not-json")).toEqual({});
    expect(parseGatewayMetadataHeader("x".repeat(4097))).toEqual({});
  });
});
