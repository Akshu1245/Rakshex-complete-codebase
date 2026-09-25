import { describe, expect, it } from "vitest";
import { __test } from "./anthropicReconciliation";

const costReport = {
  object: "page",
  data: [
    {
      starting_at: "2026-09-25T00:00:00Z",
      ending_at: "2026-09-26T00:00:00Z",
      results: [
        {
          amount: { currency: "usd", value: 2.5 },
          model: "claude-opus-4-6",
          workspace_id: "ws_fixture",
          api_key_id: "key_alpha",
        },
        {
          amount: { currency: "usd", value: 1.25 },
          model: "claude-sonnet-4-6",
          workspace_id: "ws_fixture",
          api_key_id: "key_beta",
        },
      ],
    },
  ],
  has_more: false,
  next_page: null,
};

describe("Anthropic reconciliation", () => {
  it("normalizes the documented cost report into provider evidence rows", () => {
    const rows = __test.normalizeAnthropicCosts(costReport);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rowKind: "cost",
      amountUsd: 2.5,
      currency: "usd",
      model: "claude-opus-4-6",
      projectId: "ws_fixture",
      apiKeyId: "key_alpha",
    });
    expect(rows[0]!.bucketStart).toEqual(new Date("2026-09-25T00:00:00Z"));
    expect(rows[0]!.bucketEnd).toEqual(new Date("2026-09-26T00:00:00Z"));
  });

  it("normalizes cache tokens from the usage report", () => {
    const rows = __test.normalizeAnthropicUsage({
      object: "page",
      data: [
        {
          starting_at: "2026-09-25T00:00:00Z",
          ending_at: "2026-09-26T00:00:00Z",
          results: [
            {
              model: "claude-sonnet-4-6",
              input_tokens: 1000,
              output_tokens: 200,
              cache_creation_input_tokens: 500,
              cache_read_input_tokens: 300,
              workspace_id: "ws_fixture",
              api_key_id: "key_alpha",
            },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowKind: "usage",
      inputTokens: 1000,
      outputTokens: 200,
      cachedInputTokens: 300,
      model: "claude-sonnet-4-6",
    });
  });

  it("defaults missing cache fields to zero instead of crashing", () => {
    const rows = __test.normalizeAnthropicUsage({
      data: [
        {
          starting_at: "2026-09-25T00:00:00Z",
          ending_at: "2026-09-26T00:00:00Z",
          results: [{ input_tokens: 10, output_tokens: 5 }],
        },
      ],
    });
    expect(rows[0]).toMatchObject({ inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 });
  });

  it("keeps distinct provider key refs from colliding without hashing them", () => {
    const left = __test.normalizeAnthropicCosts(costReport)[0]!;
    const right = __test.normalizeAnthropicCosts(costReport)[1]!;
    const again = __test.normalizeAnthropicCosts(costReport)[0]!;
    expect(left.sourceRowId).not.toBe(right.sourceRowId);
    expect(left.sourceRowId).toBe(again.sourceRowId);
    expect(left.sourceRowId.length).toBeLessThanOrEqual(128);
  });

  it("skips buckets with unparseable timestamps instead of emitting bad rows", () => {
    const rows = __test.normalizeAnthropicCosts({
      data: [{ starting_at: "not-a-date", ending_at: "also-bad", results: [{ amount: { value: 1 } }] }],
    });
    expect(rows).toHaveLength(0);
  });
});
