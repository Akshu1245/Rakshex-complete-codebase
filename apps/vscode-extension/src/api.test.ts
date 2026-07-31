import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, fallback: unknown) => fallback,
    }),
    findFiles: vi.fn(async () => []),
  },
}));

import { RakshexApi, getConfiguredBaseUrl } from "./api";

const ok = (data: unknown) =>
  new Response(JSON.stringify({ result: { data: { json: data } } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("Rakshex VS Code API transport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the production API by default", () => {
    expect(getConfiguredBaseUrl()).toBe("https://api.rakshex.in");
  });

  it("calls the deployed /api/trpc route and decodes superjson", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      ok({
        collections: 2,
        recentScans: 1,
        totalFindings: 4,
        openFindings: 3,
        weeklyCost: 1.25,
        lastScanAt: null,
      }),
    );
    const api = new RakshexApi(
      () => "https://api.rakshex.in",
      () => "rk_live_test",
    );

    const result = await api.getDashboardData();

    expect(result.openFindings).toBe(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.rakshex.in/api/trpc/vscodeExtension.getDashboardData",
    );
  });

  it("encodes query inputs using the tRPC v11 superjson envelope", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok([]));
    const api = new RakshexApi(
      () => "https://api.rakshex.in/api",
      () => "rk_live_test",
    );

    await api.getRecentFindings(7);

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/api/trpc/vscodeExtension.getRecentFindings");
    expect(JSON.parse(requestUrl.searchParams.get("input") ?? "")).toEqual({
      json: { limit: 7 },
    });
  });

  it("encodes mutations and sends the API key without duplicating /api", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok({ valid: true, user: null }));
    const api = new RakshexApi(
      () => "https://api.rakshex.in/api",
      () => undefined,
    );

    await api.validateApiKey("rk_live_example");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.rakshex.in/api/trpc/vscodeExtension.validateApiKey");
    expect(JSON.parse(String(init?.body))).toEqual({
      json: { apiKey: "rk_live_example" },
    });
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("rk_live_example");
  });

  it("builds the real health endpoint", () => {
    const api = new RakshexApi(
      () => "https://api.rakshex.in",
      () => undefined,
    );
    expect(api.getHealthUrl()).toBe("https://api.rakshex.in/api/health");
  });
});
