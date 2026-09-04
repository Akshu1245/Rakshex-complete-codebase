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

vi.mock("../workspaceApiKeys", () => ({ validateWorkspaceApiKey: mocks.validateWorkspaceApiKey }));
vi.mock("../teamGovernance", () => ({
  evaluateGatewayGovernance: mocks.evaluateGatewayGovernance,
  reserveGatewayBudget: mocks.reserveGatewayBudget,
  settleGatewayBudget: mocks.settleGatewayBudget,
  resolveWorkspaceIdentityId: mocks.resolveWorkspaceIdentityId,
  ingestUsageBatch: mocks.ingestUsageBatch,
}));
vi.mock("../../db", () => ({
  recordGatewayAudit: mocks.recordGatewayAudit,
  getDb: mocks.getDb,
}));
vi.mock("../receipts/actionReceipts", () => ({ appendActionReceipt: mocks.appendActionReceipt }));
vi.mock("./gatewayAttribution", () => ({
  parseGatewayMetadataHeader: () => ({}),
  persistSettledAttribution: mocks.persistSettledAttribution,
}));
vi.mock("../../middleware/policyEnforcement", () => ({
  buildPreflightEventContext: (input: unknown) => input,
  enforcePolicies: vi.fn(async () => undefined),
}));
vi.mock("../vault", () => ({ decryptSecret: () => "xi-test-key" }));
vi.mock("../../_core/env", () => ({ ENV: { nodeEnv: "test" } }));

import { registerElevenLabsGatewayRoutes } from "./elevenLabsProxy";

function routeHandler() {
  const post = vi.fn();
  registerElevenLabsGatewayRoutes({ post } as never);
  const registration = post.mock.calls.find(([path]) => path === "/v1/text-to-speech/:voiceId");
  if (!registration) throw new Error("elevenlabs route not registered");
  return registration[1] as (req: unknown, res: unknown) => Promise<void>;
}

describe("ElevenLabs gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appendActionReceipt.mockResolvedValue(undefined);
    mocks.recordGatewayAudit.mockResolvedValue(undefined);
    mocks.persistSettledAttribution.mockResolvedValue({ costUsd: 0.01 });
    mocks.reserveGatewayBudget.mockResolvedValue({ allowed: true, reservation: null });
    mocks.settleGatewayBudget.mockResolvedValue(undefined);
    mocks.resolveWorkspaceIdentityId.mockImplementation(async (_w: number, id?: number) => id);
  });

  it("blocks kill-switched traffic before contacting ElevenLabs", async () => {
    const handler = routeHandler();
    const res = {
      statusCode: 200,
      payload: undefined as unknown,
      headersSent: false,
      setHeader: vi.fn(),
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.payload = body;
        this.headersSent = true;
        return this;
      },
      send: vi.fn(),
    };
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

    await handler(
      {
        params: { voiceId: "voice123" },
        headers: { authorization: "Bearer rk_live_test" },
        header(name: string) {
          return (this.headers as Record<string, string>)[name.toLowerCase()];
        },
        ip: "203.0.113.10",
        body: { text: "hello world" },
      },
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(upstreamFetch).not.toHaveBeenCalled();
    expect(mocks.appendActionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "kill" }),
    );
    upstreamFetch.mockRestore();
  });
});
