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

vi.mock("../../_core/env", () => ({
  ENV: { nodeEnv: "test" },
}));

vi.mock("../vault", () => ({
  decryptSecret: () => "sk-ant-test",
}));

import { registerAnthropicGatewayRoutes } from "./anthropicProxy";

function createResponse() {
  const res: {
    statusCode: number;
    payload: unknown;
    status: (code: number) => typeof res;
    json: (body: unknown) => typeof res;
    setHeader: () => typeof res;
    type: () => typeof res;
    send: (body: unknown) => typeof res;
    headersSent: boolean;
  } = {
    statusCode: 200,
    payload: undefined,
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
    on() {
      return undefined;
    },
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
    upstreamFetch.mockRestore();
  });

  it("rejects stream=true until streaming support ships", async () => {
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
    const req = createRequest("Bearer rk_live_test");
    (req as { body: { stream: boolean } }).body.stream = true;

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(mocks.evaluateGatewayGovernance).not.toHaveBeenCalled();
  });
});
