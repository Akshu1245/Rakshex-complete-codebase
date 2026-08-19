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
  decryptSecret: vi.fn(),
  enforcePolicies: vi.fn(),
  buildPreflightEventContext: vi.fn(() => ({})),
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

vi.mock("../vault", () => ({
  decryptSecret: mocks.decryptSecret,
}));

vi.mock("../../middleware/policyEnforcement", () => ({
  enforcePolicies: mocks.enforcePolicies,
  buildPreflightEventContext: mocks.buildPreflightEventContext,
}));

vi.mock("../../_core/env", () => ({
  ENV: { nodeEnv: "test" },
}));

vi.mock("../../_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerOpenAiGatewayRoutes } from "./openAiProxy";

function createRequest(authorization?: string, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    ...(authorization ? { authorization } : {}),
    ...extraHeaders,
  };
  return {
    headers,
    body: {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }],
      stream: false,
    },
    ip: "203.0.113.10",
    header(name: string) {
      return headers[name.toLowerCase()];
    },
    on: vi.fn(),
  };
}

function createResponse() {
  const response = {
    statusCode: 200,
    payload: undefined as unknown,
    headersSent: false,
    setHeader: vi.fn(),
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

function routeHandler() {
  const post = vi.fn();
  registerOpenAiGatewayRoutes({ post } as never);
  const registration = post.mock.calls.find(([path]) => path === "/v1/chat/completions");
  if (!registration) throw new Error("gateway route not registered");
  return registration[1] as (req: unknown, res: unknown) => Promise<void>;
}

describe("OpenAI-compatible gateway route enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordGatewayAudit.mockResolvedValue(undefined);
    mocks.reserveGatewayBudget.mockResolvedValue({ allowed: true, reservation: null });
    mocks.settleGatewayBudget.mockResolvedValue(undefined);
    mocks.resolveWorkspaceIdentityId.mockImplementation(
      async (_workspaceId: number, identityId?: number) => identityId,
    );
    mocks.enforcePolicies.mockResolvedValue(undefined);
    mocks.decryptSecret.mockReturnValue("openrouter-central-secret");
  });

  it("rejects requests without a workspace key", async () => {
    const handler = routeHandler();
    const res = createResponse();

    await handler(createRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
  });

  it("blocks before any upstream call when a scoped kill switch is active", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: false,
      killActive: true,
      budgetBlocked: false,
      budgetReason: null,
      state: { workspaceDisabled: true },
    });

    await handler(createRequest("Bearer rk_live_test_workspace_key"), res);

    expect(res.statusCode).toBe(403);
    expect(mocks.recordGatewayAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "7",
        decision: "blocked",
        blockReason: "A scoped kill switch is active",
      }),
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("rejects foreign identity ids before governance evaluation", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });
    mocks.resolveWorkspaceIdentityId.mockResolvedValueOnce(undefined);

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {
        "x-rakshex-identity-id": "999",
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
  });

  it("rejects attempts to override a key-bound identity", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: 12,
      agentId: null,
    });

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {
        "x-rakshex-identity-id": "999",
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect((res.payload as { error: { code: string } }).error.code).toBe("identity_scope_mismatch");
    expect(mocks.resolveWorkspaceIdentityId).not.toHaveBeenCalled();
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
  });

  it("fails closed when governance state cannot be loaded", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });
    mocks.evaluateGatewayGovernance.mockRejectedValue(new Error("database down"));

    await handler(createRequest("Bearer rk_live_test_workspace_key"), res);

    expect(res.statusCode).toBe(503);
    expect((res.payload as { error: { code: string } }).error.code).toBe("enforcement_unavailable");
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("forwards an allowed OpenRouter request through the configured public upstream after enforcement", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({ allowed: true });
    mocks.getDb.mockResolvedValue({
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 91,
                    adminCredentialId: 92,
                    metadata: { baseUrl: "https://openrouter.ai/api/v1" },
                  },
                ]),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 92,
                  encryptedValue: "ciphertext:openrouter",
                  credentialType: "inference_api_key",
                  status: "active",
                  expiresAt: null,
                },
              ]),
            })),
          })),
        }),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    });
    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl_openrouter",
        usage: { prompt_tokens: 2, completion_tokens: 3 },
      }),
    });
    vi.stubGlobal("fetch", upstreamFetch);

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {
        "x-rakshex-provider": "openai_compatible",
      }),
      res,
    );

    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer openrouter-central-secret" }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(mocks.recordGatewayAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai_compatible",
        decision: "allowed",
        workspaceId: 42,
      }),
    );
  });
});
