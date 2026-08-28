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
