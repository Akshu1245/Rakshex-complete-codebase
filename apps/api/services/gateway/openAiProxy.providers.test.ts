/**
 * Provider-depth route tests: Azure OpenAI and OpenRouter flow through the
 * same fail-closed enforcement core as OpenAI, with provider-specific
 * transport (origin pinning, auth style, usage accounting) verified here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateWorkspaceApiKey: vi.fn(),
  evaluateGatewayGovernance: vi.fn(),
  reserveGatewayBudget: vi.fn(),
  settleGatewayBudget: vi.fn(),
  ingestUsageBatch: vi.fn(),
  resolveWorkspaceIdentityId: vi.fn(
    async (_workspaceId: number, identityId?: number) => identityId,
  ),
  recordGatewayAudit: vi.fn(),
  getDb: vi.fn(),
  appendActionReceipt: vi.fn(),
  persistSettledAttribution: vi.fn(),
}));

vi.mock("../workspaceApiKeys", () => ({
  validateWorkspaceApiKey: mocks.validateWorkspaceApiKey,
}));

vi.mock("../teamGovernance", () => ({
  evaluateGatewayGovernance: mocks.evaluateGatewayGovernance,
  reserveGatewayBudget: mocks.reserveGatewayBudget,
  settleGatewayBudget: mocks.settleGatewayBudget,
  ingestUsageBatch: mocks.ingestUsageBatch,
  resolveWorkspaceIdentityId: mocks.resolveWorkspaceIdentityId,
}));

vi.mock("../../db", () => ({
  recordGatewayAudit: mocks.recordGatewayAudit,
  getDb: mocks.getDb,
}));

vi.mock("../receipts/actionReceipts", () => ({
  appendActionReceipt: mocks.appendActionReceipt,
}));

vi.mock("./gatewayAttribution", () => ({
  parseGatewayMetadataHeader: () => ({}),
  persistSettledAttribution: mocks.persistSettledAttribution,
}));

vi.mock("../../_core/env", () => ({
  ENV: { nodeEnv: "test" },
}));

vi.mock("../../_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../vault", () => ({
  decryptSecret: () => "provider-secret-key",
}));

vi.mock("../../middleware/policyEnforcement", () => ({
  buildPreflightEventContext: (input: unknown) => input,
  enforcePolicies: vi.fn(async () => undefined),
}));

import { registerOpenAiGatewayRoutes } from "./openAiProxy";

function createRequest(
  extraHeaders: Record<string, string> = {},
  body: unknown = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "hello" }],
    stream: false,
  },
) {
  const headers: Record<string, string> = {
    authorization: "Bearer rk_live_test_workspace_key",
    ...extraHeaders,
  };
  return {
    headers,
    body,
    ip: "203.0.113.10",
    header(name: string) {
      return headers[name.toLowerCase()];
    },
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

function createResponse() {
  const response = {
    statusCode: 200,
    payload: undefined as unknown,
    headersSent: false,
    headers: {} as Record<string, string>,
    setHeader: vi.fn((name: string, value: string) => {
      response.headers[name] = value;
    }),
    status: vi.fn((status: number) => {
      response.statusCode = status;
      return response;
    }),
    json: vi.fn((payload: unknown) => {
      response.payload = payload;
      response.headersSent = true;
      return response;
    }),
    type: vi.fn(() => response),
    send: vi.fn(() => response),
    write: vi.fn(),
    end: vi.fn(),
    flushHeaders: vi.fn(),
  };
  return response;
}

function routeHandler(path = "/v1/chat/completions") {
  const post = vi.fn();
  registerOpenAiGatewayRoutes({ post } as never);
  const registration = post.mock.calls.find(([registeredPath]) => registeredPath === path);
  if (!registration) throw new Error(`gateway route not registered: ${path}`);
  return registration[1] as (req: unknown, res: unknown) => Promise<void>;
}

function mockConnectedProviderDb(accountMetadata: Record<string, unknown> | null = null) {
  mocks.getDb.mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => [
              {
                id: 9,
                adminCredentialId: 3,
                workspaceId: 42,
                metadata: accountMetadata,
              },
            ],
          }),
          limit: async () => [
            {
              id: 3,
              workspaceId: 42,
              status: "active",
              credentialType: "api_key",
              encryptedValue: "enc",
              expiresAt: null,
            },
          ],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
  });
}

const workspaceKey = {
  keyId: "ak_1",
  workspaceId: 42,
  userId: 7,
  scopes: ["gateway:invoke"],
  projectId: null,
  identityId: null,
  agentId: null,
};

describe("Gateway provider depth (Azure OpenAI + OpenRouter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordGatewayAudit.mockResolvedValue(undefined);
    mocks.appendActionReceipt.mockResolvedValue({ entryHash: "fixture" });
    mocks.persistSettledAttribution.mockResolvedValue({ costUsd: 0.001 });
    mocks.reserveGatewayBudget.mockResolvedValue({ allowed: true, reservation: null });
    mocks.settleGatewayBudget.mockResolvedValue(undefined);
    mocks.validateWorkspaceApiKey.mockResolvedValue(workspaceKey);
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: true,
      killActive: false,
      budgetBlocked: false,
      budgetReason: null,
    });
  });

  it("routes Azure OpenAI through the validated resource endpoint with api-key auth", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mockConnectedProviderDb({ resourceEndpoint: "https://myres.openai.azure.com" });
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-1",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    } as never);

    await handler(createRequest({ "x-rakshex-provider": "azure_openai" }), res);

    expect(res.statusCode).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://myres.openai.azure.com/openai/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ "api-key": "provider-secret-key" }),
      }),
    );
    const fetchHeaders = upstreamFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(fetchHeaders.authorization).toBeUndefined();
    expect(mocks.persistSettledAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "azure_openai",
        inputTokens: 10,
        outputTokens: 5,
        usageVerified: true,
        providerReportedCostUsd: undefined,
      }),
    );
    upstreamFetch.mockRestore();
  });

  it("blocks Azure OpenAI fail-closed when the resource endpoint is not Microsoft-operated", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mockConnectedProviderDb({ resourceEndpoint: "https://attacker.example.com" });
    const upstreamFetch = vi.spyOn(globalThis, "fetch");

    await handler(createRequest({ "x-rakshex-provider": "azure_openai" }), res);

    expect(res.statusCode).toBe(503);
    expect((res.payload as { error: { code: string } }).error.code).toBe("provider_not_configured");
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("routes OpenRouter to its pinned origin with usage accounting and settles provider-reported cost", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mockConnectedProviderDb();
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "gen-1",
        usage: { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29, cost: 0.00073 },
      }),
    } as never);

    await handler(createRequest({ "x-rakshex-provider": "openrouter" }), res);

    expect(res.statusCode).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer provider-secret-key" }),
      }),
    );
    const sentBody = JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body)) as {
      usage?: { include?: boolean };
    };
    expect(sentBody.usage).toEqual({ include: true });
    expect(mocks.persistSettledAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openrouter",
        inputTokens: 20,
        outputTokens: 9,
        providerReportedCostUsd: 0.00073,
      }),
    );
    upstreamFetch.mockRestore();
  });

  it("rejects the Responses endpoint for OpenRouter before governance", async () => {
    const handler = routeHandler("/v1/responses");
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");

    await handler(
      createRequest({ "x-rakshex-provider": "openrouter" }, { model: "gpt-5", input: "hello" }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: { code: string } }).error.code).toBe(
      "unsupported_provider_endpoint",
    );
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "deny" }),
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("still rejects arbitrary OpenAI-compatible upstreams", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");

    await handler(createRequest({ "x-rakshex-provider": "openai_compatible" }), res);

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: { code: string } }).error.code).toBe("unsupported_provider");
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("emits budget warning headers when the reservation crosses the soft threshold", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mockConnectedProviderDb();
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-1",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    } as never);
    mocks.reserveGatewayBudget.mockResolvedValue({
      allowed: true,
      reservation: { budgetId: 5, workspaceId: 42, identityId: null, reservedUsd: 0.02 },
      warning: { limitUsd: 50, warningPct: 80, usedPct: 84.2, remainingUsd: 7.9 },
    });

    await handler(createRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-rakshex-budget-warning"]).toBe("soft-threshold-exceeded");
    expect(res.headers["x-rakshex-budget-used-pct"]).toBe("84.2");
    expect(res.headers["x-rakshex-budget-remaining-usd"]).toBe("7.9");
    upstreamFetch.mockRestore();
  });
});
