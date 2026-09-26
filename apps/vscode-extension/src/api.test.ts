import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, fallback: unknown) => fallback,
    }),
    findFiles: vi.fn(async () => []),
  },
}));

import { LIVE_API_ORIGIN, RakshexApi, getConfiguredBaseUrl } from "./api";

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("Rakshex VS Code API transport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the live Workers API origin by default", () => {
    expect(getConfiguredBaseUrl()).toBe(LIVE_API_ORIGIN);
    expect(LIVE_API_ORIGIN).toBe("https://rakshex-firewall.rakshex.workers.dev");
  });

  it("checks health at /v1/health", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok({ ok: true, service: "rakshex-firewall-workers" }));
    const api = new RakshexApi(
      () => LIVE_API_ORIGIN,
      () => "rk_live_test",
    );

    const result = await api.checkHealth();

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${LIVE_API_ORIGIN}/v1/health`);
  });

  it("evaluates actions at POST /v1/evaluate with a Bearer key", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(ok({ decision: "DENY", wouldBlock: true, reason: "no authority" }));
    const api = new RakshexApi(
      () => LIVE_API_ORIGIN,
      () => "rk_live_test",
    );

    const result = await api.evaluateAction({
      workspaceId: 1,
      requestId: "req-1",
      mode: "shadow",
      action: {
        name: "llm.prompt",
        domain: "unknown",
        effect: "unknown",
        raw: { provider: "vscode-extension", operation: "gateway-test" },
      },
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${LIVE_API_ORIGIN}/v1/evaluate`);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer rk_live_test");
    const body = JSON.parse(String(init?.body));
    expect(body.workspaceId).toBe(1);
    expect(body.mode).toBe("shadow");
    expect(result.decision).toBe("DENY");
  });

  it("builds the real health endpoint", () => {
    const api = new RakshexApi(
      () => LIVE_API_ORIGIN,
      () => undefined,
    );
    expect(api.getHealthUrl()).toBe(`${LIVE_API_ORIGIN}/v1/health`);
  });

  it("throws a clear not-available error for server features the hosted API lacks", async () => {
    const api = new RakshexApi(
      () => LIVE_API_ORIGIN,
      () => "rk_live_test",
    );
    await expect(api.getDashboardData()).rejects.toThrow(/not available on the hosted API yet/);
    await expect(api.generateApiKey()).rejects.toThrow(/not available on the hosted API yet/);
    await expect(api.copilotAsk("hi")).rejects.toThrow(/not available on the hosted API yet/);
  });

  it("scans imported collections locally without any network call", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const api = new RakshexApi(
      () => LIVE_API_ORIGIN,
      () => "rk_live_test",
    );

    const result = await api.importCollection("demo", "postman", {
      info: { name: "demo" },
      item: [
        {
          name: "login",
          request: {
            method: "POST",
            url: "http://example.com/login",
            header: [],
            body: { raw: JSON.stringify({ api_key: "sk-abcdefgh12345678" }) },
          },
        },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.name).toBe("demo");
    expect(result.credentialFindings?.length).toBeGreaterThan(0);
    expect(result.credentialFindings?.some((f) => f.ruleId === "plaintext-http")).toBe(true);
  });
});
