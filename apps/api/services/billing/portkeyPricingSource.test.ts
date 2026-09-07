import { describe, expect, it } from "vitest";
import { centsPerTokenToUsdPerMillion, parsePortkeyPricing } from "./portkeyPricingSource";

describe("Portkey pricing source", () => {
  it("converts cents/token into RaksHex USD per million", () => {
    expect(centsPerTokenToUsdPerMillion(0.00025)).toBe(2.5);
    expect(centsPerTokenToUsdPerMillion(0.003)).toBe(30);
  });

  it("normalizes text and cache prices without importing the default row", () => {
    const result = parsePortkeyPricing("openai", {
      default: {
        pricing_config: {
          pay_as_you_go: {
            request_token: { price: 0 },
            response_token: { price: 0 },
          },
        },
      },
      "gpt-test": {
        pricing_config: {
          pay_as_you_go: {
            request_token: { price: 0.00025 },
            response_token: { price: 0.001 },
            cache_read_input_token: { price: 0.000125 },
          },
        },
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        provider: "openai",
        model: "gpt-test",
        inputPerMillion: 2.5,
        outputPerMillion: 10,
        cachedInputPerMillion: 1.25,
      }),
    ]);
  });

  it("rejects incomplete price rows rather than guessing", () => {
    expect(
      parsePortkeyPricing("anthropic", {
        incomplete: { pricing_config: { pay_as_you_go: { request_token: { price: 1 } } } },
      }),
    ).toEqual([]);
  });
});
