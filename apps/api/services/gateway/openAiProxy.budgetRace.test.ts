import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateWorkspaceApiKey: vi.fn(),
  evaluateGatewayGovernance: vi.fn(),
  reserveGatewayBudget: vi.fn(),
  settleGatewayBudget: vi.fn(),
  ingestUsageBatch: vi.fn(),
  resolveWorkspaceIdentityId: vi.fn(async (_workspaceId: number, identityId?: number) => identityId),
  recordGatewayAudit: vi.fn(),
  getDb: vi.fn(),
  persistSettledAttribution: vi.fn(),
  enforcePolicies: vi.fn(),
  appendActionReceipt: vi.fn(),
}));

vi.mock("../workspaceApiKeys", () => ({ validateWorkspaceApiKey: mocks.validateWorkspaceApiKey }));
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
vi.mock("../vault", () => ({ decryptSecret: vi.fn(() => "sk_fixture_not_live") }));
vi.mock("./gatewayAttribution", () => ({
  parseGatewayMetadataHeader: vi.fn(() => ({})),
  persistSettledAttribution: mocks.persistSettledAttribution,
}));
vi.mock("../receipts/actionReceipts", () => ({
  appendActionReceipt: mocks.appendActionReceipt,
}));
vi.mock("../../middleware/policyEnforcement", () => ({
  buildPreflightEventContext: vi.fn(() => ({})),
  enforcePolicies: mocks.enforcePolicies,
}));
vi.mock("../../_core/env", () => ({ ENV: { nodeEnv: "test" } }));
vi.mock("../../_core/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerOpenAiGatewayRoutes } from "./openAiProxy";

function request() {
  const headers: Record<string, string> = { authorization: "Bearer rk_fixture_workspace" };
  return {
    headers,
    body: {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "budget-race-fixture" }],
      stream: false,
      max_tokens: 10,
    },
    ip: "203.0.113.20",
    header(name: string) {
      return headers[name.toLowerCase()];
    },
    on: vi.fn(),
  };
}

function response() {
  const res = {
    statusCode: 200,
    payload: undefined as unknown,
    headersSent: false,
    setHeader: vi.fn(),
    status: vi.fn((status: number) => {
      res.statusCode = status;
      return res;
    }),
    json: vi.fn((payload: unknown) => {
      res.payload = payload;
      res.headersSent = true;
      return res;
    }),
    type: vi.fn(() => res),
    send: vi.fn(() => res),
    write: vi.fn(),
    end: vi.fn(),
    flushHeaders: vi.fn(),
  };
  return res;
}

function handler() {
  const post = vi.fn();
  registerOpenAiGatewayRoutes({ post } as never);
  const route = post.mock.calls.find(([path]) => path === "/v1/chat/completions");
  if (!route) throw new Error("chat gateway route not registered");
  return route[1] as (req: unknown, res: unknown) => Promise<void>;
}

describe("parallel hard-budget race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateWorkspaceApiKey.mockResolvedValue({
      keyId: "ak_fixture",
      workspaceId: 42,
      userId: 7,
      scopes: ["gateway:invoke"],
      projectId: null,
    });
    mocks.evaluateGatewayGovernance.mockResolvedValue({
      allowed: true,
      killActive: false,
      budgetBlocked: false,
      budgetReason: null,
      state: {},
    });
    mocks.recordGatewayAudit.mockResolvedValue(undefined);
    mocks.settleGatewayBudget.mockResolvedValue(undefined);
    mocks.ingestUsageBatch.mockResolvedValue({ inserted: 1, skipped: 0 });
    mocks.persistSettledAttribution.mockResolvedValue({ costUsd: 0.00001 });
    mocks.enforcePolicies.mockResolvedValue({ action: "allow" });
    mocks.appendActionReceipt.mockResolvedValue({ entryHash: "fixture" });

    const providerAccount = { id: 88, adminCredentialId: 77, metadata: {} };
    const credential = {
      id: 77,
      encryptedValue: "encrypted-fixture",
      credentialType: "inference_api_key",
      status: "active",
      expiresAt: null,
    };
    mocks.getDb.mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: async () => [providerAccount] }),
            limit: async () => [credential],
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    });
  });

  it("allows only one of two concurrent requests and never fetches for the loser", async () => {
    let reserved = false;
    mocks.reserveGatewayBudget.mockImplementation(async () => {
      await Promise.resolve();
      if (reserved) {
        return {
          allowed: false,
          reason: "identity/workspace gateway budget would be exceeded",
        };
      }
      reserved = true;
      return {
        allowed: true,
        reservation: { budgetId: 9, workspaceId: 42, identityId: null, reservedUsd: 0.01 },
      };
    });

    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl_fixture",
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      }),
      headers: { get: () => "application/json" },
    } as never);

    const run = handler();
    const first = response();
    const second = response();
    await Promise.all([run(request(), first), run(request(), second)]);

    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 403]);
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(mocks.persistSettledAttribution).toHaveBeenCalledTimes(1);
    expect(mocks.appendActionReceipt).toHaveBeenCalledTimes(3);
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "deny" }),
    );
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "allow" }),
    );
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "settle" }),
    );
    upstreamFetch.mockRestore();
  });
});
