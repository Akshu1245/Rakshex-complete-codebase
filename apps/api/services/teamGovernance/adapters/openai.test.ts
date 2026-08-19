import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAiAdapter } from "./openai";

describe("OpenAI Admin API governance adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a customer authorized Admin API credential and never substitutes an inference key", async () => {
    const result = await createOpenAiAdapter().sync({ workspaceId: 5 });

    expect(result).toMatchObject({
      status: "not_configured",
      errorCode: "NOT_CONFIGURED",
    });
  });

  it("normalizes authorized organization seats, daily project usage, and daily USD costs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "user_1", email: "dev@acme.test", name: "Dev", role: "member" }],
          has_more: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              start_time: 1_700_000_000,
              end_time: 1_700_086_400,
              results: [
                {
                  project_id: "proj_abc",
                  input_tokens: 120,
                  output_tokens: 80,
                  num_model_requests: 4,
                },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              end_time: 1_700_086_400,
              results: [
                {
                  project_id: "proj_abc",
                  amount: { value: 1.23, currency: "usd" },
                },
              ],
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAiAdapter().sync({
      workspaceId: 5,
      providerAccountId: 12,
      adminCredential: "sk-admin-never-persisted-in-test-output",
      since: new Date(1_700_000_000_000),
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected successful sync");
    expect(result.seats).toEqual([
      expect.objectContaining({
        externalUserId: "user_1",
        email: "dev@acme.test",
        role: "member",
      }),
    ]);
    expect(result.usageEvents).toEqual([
      expect.objectContaining({
        externalEventId: "openai:12:1700086400:proj_abc",
        requestCount: 4,
        inputTokens: 120,
        outputTokens: 80,
        costUsd: 1.23,
        confidence: "verified",
      }),
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/organization/usage/completions?"),
      expect.objectContaining({
        headers: { authorization: "Bearer sk-admin-never-persisted-in-test-output" },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/organization/costs?"),
      expect.anything(),
    );
  });

  it("reports an authorization failure without emitting partial telemetry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAiAdapter().sync({
      workspaceId: 5,
      adminCredential: "sk-admin-rejected",
    });

    expect(result).toMatchObject({
      status: "failed",
      errorCode: "OPENAI_ADMIN_SYNC_FAILED",
      errorMessage: "OpenAI rejected the connected Admin API credential",
    });
  });
});
