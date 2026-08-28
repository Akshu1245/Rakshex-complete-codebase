import { describe, expect, it } from "vitest";
import costsFixture from "./fixtures/openai-costs.json";
import { __test } from "./openAiBillingReconciliation";

describe("OpenAI billing reconciliation", () => {
  it("parses the documented Costs API bucket shape and reconciles within one percent", () => {
    const rows = __test.normalizeOpenAiCosts(costsFixture);
    const providerBilled = rows.reduce((sum, row) => sum + (row.amountUsd ?? 0), 0);
    const result = __test.calculateReconciliation(providerBilled, 1.0);

    expect(rows).toHaveLength(2);
    expect(providerBilled).toBeCloseTo(1.005, 8);
    expect(result.driftPct).toBeLessThanOrEqual(0.01);
    expect(result.status).toBe("ok");
  });

  it("flags provider-vs-gateway drift above one percent", () => {
    const result = __test.calculateReconciliation(1.25, 1.0);
    expect(result.driftPct).toBeGreaterThan(0.01);
    expect(result.status).toBe("drift");
  });

  it("computes an explicit pro-rata factor for per-call reconciled cost", () => {
    expect(__test.providerAllocationFactor(1.005, 1.0)).toBeCloseTo(1.005, 10);
    expect(__test.providerAllocationFactor(0, 0)).toBeNull();
  });

  it("builds daily Costs requests with the required provider grouping dimensions", () => {
    const url = new URL(__test.buildAdminUrl("costs", 100, 200));
    expect(url.pathname).toBe("/v1/organization/costs");
    expect(url.searchParams.get("bucket_width")).toBe("1d");
    expect(url.searchParams.getAll("group_by")).toEqual([
      "project_id",
      "api_key_id",
      "line_item",
    ]);
  });

  it("normalizes cached tokens from the documented completions Usage API shape", () => {
    const rows = __test.normalizeOpenAiCompletionsUsage({
      object: "page",
      data: [
        {
          object: "bucket",
          start_time: 1787875200,
          end_time: 1787961600,
          results: [
            {
              object: "organization.usage.completions.result",
              input_tokens: 120,
              output_tokens: 40,
              input_cached_tokens: 80,
              num_model_requests: 2,
              api_key_id: "key_fixture_alpha",
              model: "gpt-5-mini",
              project_id: "proj_fixture",
            },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      inputTokens: 120,
      outputTokens: 40,
      cachedInputTokens: 80,
      requestCount: 2,
      projectId: "proj_fixture",
      model: "gpt-5-mini",
    });
  });
});
