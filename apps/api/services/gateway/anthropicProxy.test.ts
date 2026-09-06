import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateWorkspaceApiKey: vi.fn(),
  evaluateGatewayGovernance: vi.fn(),
  reserveGatewayBudget: vi.fn(),
  settleGatewayBudget: vi.fn(),
  resolveWorkspaceIdentityId: vi.fn(),
  ingestUsageBatch: vi.fn(),
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

vi.mock("../vault", () => ({
  decryptSecret: () => "sk-ant-test",
}));

vi.mock("../../middleware/policyEnforcement", () => ({
  buildPreflightEventContext: vi.fn(() => ({})),
  enforcePolicies: vi.fn(),
}));

import { registerAnthropicGatewayRoutes, __test } from "./anthropicProxy";

function createResponse() {
  const chunks: Buffer[] = [];
  const res: {
    statusCode: number;
    payload: unknown;
    chunks: Buffer[];
    status: (code: number) => typeof res;
    json: (body: unknown) => typeof res;
    setHeader: () => typeof res;
    type: () => typeof res;
    send: (body: unknown) => typeof res;
    write: (chunk: Buffer) => boolean;
    flushHeaders: () => void;
    end: () => void;
    headersSent: boolean;
  } = {
    statusCode: 200,
    payload: undefined,
    chunks,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      this.headersSent = true;
      return this;
    },
    setHeader() {
      return this;
    },
    type() {
      return this;
    },
    send(body: unknown) {
      this.payload = body;
      this.headersSent = true;
      return this;
    },
    write(chunk: Buffer) {
      chunks.push(chunk);
      return true;
    },
    flushHeaders() {},
    end() {
      this.headersSent = true;
    },
  };
  return res;
}

function createRequest(auth?: string, headers: Record<string, string> = {}) {
  return {
    headers: {
      authorization: auth,
      ...headers,
    },
    header(name: string) {
      const key = name.toLowerCase();
      const found = Object.entries(this.headers).find(([k]) => k.toLowerCase() === key);
      return found?.[1];
    },
    ip: "203.0.113.10",
    body: {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 128,
      messages: [{ role: "user", content: "hello" }],
    },
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

function routeHandler() {
  const post = vi.fn();
  registerAnthropicGatewayRoutes({ post } as never);
  const registration = post.mock.calls.find(([path]) => path === "/v1/messages");
  if (!registration) throw new Error("anthropic route not registered");
  return registration[1] as (req: unknown, res: unknown) => Promise<void>;
}

describe("Anthropic Messages gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordGatewayAudit.mockResolvedValue(undefined);
    mocks.appendActionReceipt.mockResolvedValue(undefined);
    mocks.persistSettledAttribution.mockResolvedValue({ costUsd: 0.01 });
    mocks.reserveGatewayBudget.mockResolvedValue({ allowed: true, reservation: null });
    mocks.settleGatewayBudget.mockResolvedValue(undefined);
    mocks.resolveWorkspaceIdentityId.mockImplementation(
      async (_workspaceId: number, identityId?: number) => identityId,
    );
    mocks.getDb.mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [
                {
                  id: 9,
                  adminCredentialId: 3,
                  provider: "anthropic",
                  workspaceId: 42,
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
  });

  it("blocks kill-switched traffic before contacting Anthropic", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: null,
      agentId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: false,
      killActive: true,
      budgetBlocked: false,
      budgetReason: null,
    });

    await handler(createRequest("Bearer rk_live_test"), res);

    expect(res.statusCode).toBe(403);
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(mocks.recordGatewayAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 42,
        provider: "anthropic",
        decision: "blocked",
      }),
    );
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 42, eventType: "kill" }),
    );
    upstreamFetch.mockRestore();
  });

  it("blocks fail-closed when the signed receipt ledger is unavailable", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch");
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: null,
      agentId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: true,
      killActive: false,
      budgetBlocked: false,
      budgetReason: null,
    });
    mocks.appendActionReceipt.mockRejectedValue(new Error("ledger down"));

    await handler(createRequest("Bearer rk_live_test"), res);

    expect(res.statusCode).toBe(503);
    expect(upstreamFetch).not.toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("settles a successful call through unified attribution with the thinking-table fallback", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "msg_1",
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10 },
      }),
    } as never);
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: "proj-key",
      identityId: null,
      agentId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: true,
      killActive: false,
      budgetBlocked: false,
      budgetReason: null,
    });
    mocks.persistSettledAttribution.mockResolvedValue({ costUsd: 0.0042 });

    await handler(createRequest("Bearer rk_live_test"), res);

    expect(res.statusCode).toBe(200);
    expect(mocks.persistSettledAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 42,
        provider: "anthropic",
        projectId: "proj-key",
        inputTokens: 100,
        outputTokens: 50,
        cachedInputTokens: 10,
        usageVerified: true,
        fallbackCostUsd: expect.any(Number),
        endpoint: "messages",
      }),
    );
    expect(mocks.ingestUsageBatch).toHaveBeenCalledWith(42, [
      expect.objectContaining({ provider: "anthropic", costUsd: 0.0042, confidence: "verified" }),
    ]);
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "settle" }),
    );
    upstreamFetch.mockRestore();
  });

  it("never derives enforcement scope from request headers when the key is unbound", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg_1", usage: { input_tokens: 1, output_tokens: 1 } }),
    } as never);
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: null,
      agentId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: true,
      killActive: false,
      budgetBlocked: false,
      budgetReason: null,
    });

    await handler(
      createRequest("Bearer rk_live_test", {
        "x-rakshex-identity-id": "31337",
        "x-rakshex-project-id": "spoofed-project",
        "x-rakshex-agent-id": "spoofed-agent",
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(mocks.reserveGatewayBudget).toHaveBeenCalledWith(
      expect.objectContaining({ identityId: undefined }),
    );
    expect(mocks.persistSettledAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: undefined,
        projectId: undefined,
        agentId: undefined,
      }),
    );
    upstreamFetch.mockRestore();
  });

  it("emits budget warning headers when the soft threshold is crossed", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const setHeader = vi.fn();
    (res as { setHeader: unknown }).setHeader = setHeader;
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg_1", usage: { input_tokens: 1, output_tokens: 1 } }),
    } as never);
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: null,
      agentId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: true,
      killActive: false,
      budgetBlocked: false,
      budgetReason: null,
    });
    mocks.reserveGatewayBudget.mockResolvedValue({
      allowed: true,
      reservation: { budgetId: 1, workspaceId: 42, identityId: null, reservedUsd: 0.01 },
      warning: { limitUsd: 100, warningPct: 80, usedPct: 91.5, remainingUsd: 8.5 },
    });

    await handler(createRequest("Bearer rk_live_test"), res);

    expect(res.statusCode).toBe(200);
    expect(setHeader).toHaveBeenCalledWith("x-rakshex-budget-warning", "soft-threshold-exceeded");
    expect(setHeader).toHaveBeenCalledWith("x-rakshex-budget-used-pct", "91.5");
    expect(setHeader).toHaveBeenCalledWith("x-rakshex-budget-remaining-usd", "8.5");
    upstreamFetch.mockRestore();
  });

  it("streams Anthropic SSE responses and settles usage from message events", async () => {
    const handler = routeHandler();
    const res = createResponse();
    const sseBody = [
      "event: message_start",
      'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1,"cache_read_input_tokens":2}}}',
      "",
      "event: content_block_delta",
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
      "",
      "event: message_delta",
      'data: {"type":"message_delta","usage":{"output_tokens":6}}',
      "",
      "event: message_stop",
      'data: {"type":"message_stop"}',
      "",
    ].join("\n");
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseBody));
          controller.close();
        },
      }),
    } as never);
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_1",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
      identityId: null,
      agentId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: true,
      killActive: false,
      budgetBlocked: false,
      budgetReason: null,
    });
    mocks.persistSettledAttribution.mockResolvedValue({ costUsd: 0.0031 });
    const req = createRequest("Bearer rk_live_test");
    (req.body as { stream?: boolean }).stream = true;

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.chunks.join("")).toContain("message_delta");
    expect(mocks.persistSettledAttribution).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: 12,
        outputTokens: 6,
        cachedInputTokens: 2,
        usageVerified: true,
      }),
    );
    expect(mocks.settleGatewayBudget).toHaveBeenCalled();
    upstreamFetch.mockRestore();
  });

  it("extracts Anthropic streaming usage from SSE audit tail", () => {
    const raw = [
      "event: message_start",
      'data: {"type":"message_start","message":{"usage":{"input_tokens":8,"cache_read_input_tokens":1}}}',
      "",
      "event: message_delta",
      'data: {"type":"message_delta","usage":{"output_tokens":4}}',
      "",
    ].join("\n");
    expect(__test.extractAnthropicStreamingUsage(raw)).toEqual({
      prompt_tokens: 8,
      completion_tokens: 4,
      total_tokens: 12,
      cached_input_tokens: 1,
    });
  });
});
