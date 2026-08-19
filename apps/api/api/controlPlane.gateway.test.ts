import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertWorkspacePermission: vi.fn(),
  getDb: vi.fn(),
  createAuditLogEntry: vi.fn(),
  encryptSecret: vi.fn(),
  fingerprint: vi.fn(),
}));

vi.mock("../services/workspaceContext", () => ({
  assertWorkspacePermission: mocks.assertWorkspacePermission,
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
  createAuditLogEntry: mocks.createAuditLogEntry,
}));

vi.mock("../services/vault", () => ({
  encryptSecret: mocks.encryptSecret,
  getVault: () => ({ fingerprint: mocks.fingerprint }),
}));

vi.mock("../services/agentguard/loopDetector", () => ({
  detectAgentLoop: vi.fn(),
  createRedisLoopStore: vi.fn(),
}));

vi.mock("../_core/cache", () => ({ redis: {} }));

import { controlPlaneRouter } from "./controlPlane";

function createMutationDb(existingAccount?: { id: number; adminCredentialId: number | null }) {
  const updates: Array<{ values: unknown }> = [];
  const inserted: Array<{ values: unknown }> = [];
  const transactionDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              for: vi.fn().mockResolvedValue(existingAccount ? [existingAccount] : []),
            })),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        inserted.push({ values });
        return {
          returning: vi
            .fn()
            .mockResolvedValue([{ id: inserted.length === 1 && !existingAccount ? 41 : 72 }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updates.push({ values });
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    })),
  };
  return {
    transaction: vi.fn((callback: (tx: typeof transactionDb) => unknown) =>
      callback(transactionDb),
    ),
    inserted,
    updates,
  };
}

function createCaller() {
  return controlPlaneRouter.createCaller({
    user: { id: 17, role: "editor" },
    req: { headers: { "x-api-key": "test-runtime-key" }, protocol: "https" },
    res: { clearCookie: () => {} },
  } as never);
}

describe("controlPlane.providers.connectOpenAiGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertWorkspacePermission.mockResolvedValue("admin");
    mocks.encryptSecret.mockReturnValue("ciphertext:encrypted");
    mocks.fingerprint.mockReturnValue("fp:workspace-scoped");
    mocks.createAuditLogEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("encrypts a new inference key, connects the provider account, and does not echo the key", async () => {
    const database = createMutationDb();
    mocks.getDb.mockResolvedValue(database);

    const result = await createCaller().providers.connectOpenAiGateway({
      workspaceId: 9,
      displayName: "Production OpenAI",
      credentialName: "Production inference key",
      secret: "sk-test-secret-value",
    });

    expect(mocks.assertWorkspacePermission).toHaveBeenCalledWith(9, 17, "policies", "write");
    expect(mocks.encryptSecret).toHaveBeenCalledWith("sk-test-secret-value", "workspace:9");
    expect(mocks.fingerprint).toHaveBeenCalledWith("sk-test-secret-value", "workspace:9");
    expect(database.inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          values: expect.objectContaining({
            accountType: "gateway_inference",
            provider: "openai",
            connectionStatus: "configuring",
          }),
        }),
        expect.objectContaining({
          values: expect.objectContaining({
            credentialType: "inference_api_key",
            encryptedValue: "ciphertext:encrypted",
            fingerprint: "fp:workspace-scoped",
          }),
        }),
      ]),
    );
    expect(result).toMatchObject({
      gatewayPath: "/v1/chat/completions",
      enforcement: "routed_traffic_only",
      rawSecretStored: false,
    });
    expect(JSON.stringify(result)).not.toContain("sk-test-secret-value");
  });

  it("revokes the replaced runtime credential and records that a rotation occurred", async () => {
    const database = createMutationDb({ id: 41, adminCredentialId: 12 });
    mocks.getDb.mockResolvedValue(database);

    const result = await createCaller().providers.connectOpenAiGateway({
      workspaceId: 9,
      displayName: "Production OpenAI",
      credentialName: "Rotated inference key",
      secret: "sk-next-secret-value",
    });

    expect(result.rotated).toBe(true);
    expect(database.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ values: expect.objectContaining({ status: "revoked" }) }),
        expect.objectContaining({
          values: expect.objectContaining({
            connectionStatus: "gateway_enforced",
            adminCredentialId: 72,
          }),
        }),
      ]),
    );
    expect(mocks.createAuditLogEntry).toHaveBeenCalledWith(
      17,
      "openai_gateway_connected",
      expect.objectContaining({ rotatedCredential: true, enforcement: "routed_traffic_only" }),
    );
  });
});

describe("controlPlane.providers.connectOpenRouterGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertWorkspacePermission.mockResolvedValue("admin");
    mocks.encryptSecret.mockReturnValue("ciphertext:openrouter-encrypted");
    mocks.fingerprint.mockReturnValue("fp:openrouter-workspace-scoped");
    mocks.createAuditLogEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates, encrypts, and connects a dedicated OpenRouter key without returning it", async () => {
    const database = createMutationDb();
    mocks.getDb.mockResolvedValue(database);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { label: "RaksHex production", limit_remaining: 87.5 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCaller().providers.connectOpenRouterGateway({
      workspaceId: 9,
      displayName: "OpenRouter production",
      credentialName: "OpenRouter gateway API key",
      secret: "sk-or-customer-secret",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/key",
      expect.objectContaining({ headers: { authorization: "Bearer sk-or-customer-secret" } }),
    );
    expect(database.inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          values: expect.objectContaining({
            provider: "openai_compatible",
            accountType: "gateway_inference",
            metadata: expect.objectContaining({ baseUrl: "https://openrouter.ai/api/v1" }),
          }),
        }),
        expect.objectContaining({
          values: expect.objectContaining({
            provider: "openai_compatible",
            credentialType: "inference_api_key",
            encryptedValue: "ciphertext:openrouter-encrypted",
          }),
        }),
      ]),
    );
    expect(result).toMatchObject({
      gatewayPath: "/v1/chat/completions",
      enforcement: "routed_traffic_only",
      rawSecretStored: false,
    });
    expect(JSON.stringify(result)).not.toContain("sk-or-customer-secret");
  });

  it("does not encrypt or store an OpenRouter key rejected by the provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(
      createCaller().providers.connectOpenRouterGateway({
        workspaceId: 9,
        displayName: "OpenRouter production",
        credentialName: "Rejected OpenRouter key",
        secret: "sk-or-invalid-secret",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "OpenRouter authorization failed. Confirm a dedicated OpenRouter API key was supplied.",
    });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.encryptSecret).not.toHaveBeenCalled();
  });
});

describe("controlPlane.providers.connectOpenAiAdministration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertWorkspacePermission.mockResolvedValue("admin");
    mocks.encryptSecret.mockReturnValue("ciphertext:admin-encrypted");
    mocks.fingerprint.mockReturnValue("fp:admin-workspace-scoped");
    mocks.createAuditLogEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates the customer Admin API key before encrypting it and never echoes the secret", async () => {
    const database = createMutationDb();
    mocks.getDb.mockResolvedValue(database);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "org_123", name: "Acme AI" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCaller().providers.connectOpenAiAdministration({
      workspaceId: 9,
      displayName: "Acme OpenAI administration",
      credentialName: "Acme Admin API key",
      secret: "sk-admin-customer-secret",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/organization",
      expect.objectContaining({
        headers: { authorization: "Bearer sk-admin-customer-secret" },
      }),
    );
    expect(database.inserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          values: expect.objectContaining({
            accountType: "admin_telemetry",
            externalId: "org_123",
            authMethod: "admin_api",
          }),
        }),
        expect.objectContaining({
          values: expect.objectContaining({
            credentialType: "admin_api_key",
            encryptedValue: "ciphertext:admin-encrypted",
          }),
        }),
      ]),
    );
    expect(result).toMatchObject({
      organizationId: "org_123",
      enforcement: "monitoring_and_provider_native_controls",
      rawSecretStored: false,
    });
    expect(JSON.stringify(result)).not.toContain("sk-admin-customer-secret");
  });

  it("does not store a credential when OpenAI rejects the authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createCaller().providers.connectOpenAiAdministration({
        workspaceId: 9,
        displayName: "Acme OpenAI administration",
        credentialName: "Rejected Admin API key",
        secret: "sk-admin-invalid-secret",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "OpenAI Admin API authorization failed. Confirm an organization Admin API key was supplied.",
    });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.encryptSecret).not.toHaveBeenCalled();
  });
});
