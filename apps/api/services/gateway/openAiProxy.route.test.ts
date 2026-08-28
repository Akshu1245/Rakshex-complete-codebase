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

vi.mock("../../_core/env", () => ({
  ENV: { nodeEnv: "test" },
}));

vi.mock("../../_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerOpenAiGatewayRoutes } from "./openAiProxy";

const defaultChatBody = {
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "hello" }],
  stream: false,
};

const defaultResponsesBody = {
  model: "gpt-5",
  input: "hello",
  stream: false,
};

function createRequest(
  authorization?: string,
  extraHeaders: Record<string, string> = {},
  body: unknown = defaultChatBody,
) {
  const headers: Record<string, string> = {
    ...(authorization ? { authorization } : {}),
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

function routeHandler(path = "/v1/chat/completions") {
  const post = vi.fn();
  registerOpenAiGatewayRoutes({ post } as never);
  const registration = post.mock.calls.find(([registeredPath]) => registeredPath === path);
  if (!registration) throw new Error(`gateway route not registered: ${path}`);
  return registration[1] as (req: unknown, res: unknown) => Promise<void>;
}

describe("OpenAI-compatible gateway route enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordGatewayAudit.mockResolvedValue(undefined);
    mocks.appendActionReceipt.mockResolvedValue({ entryHash: "fixture" });
    mocks.reserveGatewayBudget.mockResolvedValue({ allowed: true, reservation: null });
    mocks.settleGatewayBudget.mockResolvedValue(undefined);
    mocks.resolveWorkspaceIdentityId.mockImplementation(
      async (_workspaceId: number, identityId?: number) => identityId,
    );
  });

  it("rejects requests without a workspace key", async () => {
    const handler = routeHandler();
    const res = createResponse();

    await handler(createRequest(), res);

    expect(res.statusCode).toBe(401);
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
    expect(mocks.appendActionReceipt).not.toHaveBeenCalled();
  });

  it("authenticates Responses before revealing request-schema errors", async () => {
    const handler = routeHandler("/v1/responses");
    const res = createResponse();

    await handler(createRequest(undefined, {}, {}), res);

    expect(res.statusCode).toBe(401);
    expect((res.payload as { error: { code: string } }).error.code).toBe("invalid_api_key");
    expect(mocks.validateWorkspaceApiKey).not.toHaveBeenCalled();
  });

  it("validates Responses after authentication but before governance", async () => {
    const handler = routeHandler("/v1/responses");
    const res = createResponse();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });

    await handler(createRequest("Bearer rk_live_test_workspace_key", {}, {}), res);

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: { code: string } }).error.code).toBe("invalid_request");
    expect(mocks.validateWorkspaceApiKey).toHaveBeenCalledOnce();
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "deny", workspaceId: 42 }),
    );
  });

  it("blocks Chat Completions before any upstream call when a scoped kill switch is active", async () => {
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
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "kill", workspaceId: 42 }),
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("blocks Responses before any upstream call when a scoped kill switch is active", async () => {
    const handler = routeHandler("/v1/responses");
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

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {}, defaultResponsesBody),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(mocks.recordGatewayAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "7",
        decision: "blocked",
        blockReason: "A scoped kill switch is active",
      }),
    );
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "kill",
        workspaceId: 42,
        payload: expect.objectContaining({ endpoint: "responses", model: "gpt-5" }),
      }),
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("keeps unbound header scopes out of governance", async () => {
    const handler = routeHandler();
    const res = createResponse();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: null,
      agentId: null,
    });
    mocks.resolveWorkspaceIdentityId.mockResolvedValueOnce(12);
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: false,
      killActive: true,
      budgetBlocked: false,
      budgetReason: null,
      state: { workspaceDisabled: true },
    });

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {
        "x-rakshex-identity-id": "12",
        "x-rakshex-project-id": "client-project",
        "x-rakshex-agent-id": "client-agent",
      }),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(mocks.evaluateGatewayGovernance).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 42,
        identityId: undefined,
        projectId: undefined,
        agentId: undefined,
      }),
    );
  });

  it("uses server-owned request ids despite repeated client X-Request-Id", async () => {
    const handler = routeHandler();
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
    const one = createResponse();
    const two = createResponse();
    const request = () =>
      createRequest("Bearer rk_live_test_workspace_key", { "x-request-id": "fixed-client-id" });

    await handler(request(), one);
    await handler(request(), two);

    const idOne = one.setHeader.mock.calls.find(([name]) => name === "x-request-id")?.[1];
    const idTwo = two.setHeader.mock.calls.find(([name]) => name === "x-request-id")?.[1];
    expect(idOne).toEqual(expect.any(String));
    expect(idTwo).toEqual(expect.any(String));
    expect(idOne).not.toBe("fixed-client-id");
    expect(idTwo).not.toBe("fixed-client-id");
    expect(idOne).not.toBe(idTwo);
  });

  it("rejects custom compatible upstreams before any provider egress", async () => {
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

    await handler(
      createRequest("Bearer rk_live_test_workspace_key", {
        "x-rakshex-provider": "openai_compatible",
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
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
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "deny" }),
    );
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
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "deny" }),
    );
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
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "deny" }),
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("rejects background Responses before governance and upstream fetch", async () => {
    const handler = routeHandler("/v1/responses");
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });

    await handler(
      createRequest(
        "Bearer rk_live_test_workspace_key",
        {},
        { model: "gpt-5", input: "hello", background: true },
      ),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: { code: string } }).error.code).toBe("unsupported_background");
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "deny", workspaceId: 42 }),
    );
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });
});
