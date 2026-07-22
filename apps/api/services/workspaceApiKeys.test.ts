import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
}));

import {
  apiKeyHasScope,
  createWorkspaceApiKey,
  generateRawApiKey,
  validateWorkspaceApiKey,
} from "./workspaceApiKeys";
import { hashApiKey } from "../utils/crypto";

describe("API key helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates rk_live_ prefixed secrets", () => {
    const k = generateRawApiKey("live");
    expect(k.startsWith("rk_live_")).toBe(true);
    expect(k.length).toBeGreaterThan(40);
  });

  it("hash is deterministic and not equal to raw", () => {
    const raw = generateRawApiKey("test");
    const h1 = hashApiKey(raw);
    const h2 = hashApiKey(raw);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(raw);
  });

  it("scope check allows * and admin", () => {
    expect(apiKeyHasScope(["*"], "scan:write")).toBe(true);
    expect(apiKeyHasScope(["admin"], "scan:write")).toBe(true);
    expect(apiKeyHasScope(["scan:read"], "scan:write")).toBe(false);
    expect(apiKeyHasScope(["scan:write"], "scan:write")).toBe(true);
  });

  it("defaults new keys to least-privilege scan:read instead of wildcard", async () => {
    let inserted: Record<string, unknown> | undefined;
    const row = {
      id: "ak_1",
      workspaceId: 2,
      createdByUserId: 7,
      name: "minimal",
      keyPrefix: "rk_live_test",
      keyHash: "hash",
      keySuffix: "abcd",
      environment: "live",
      scopes: ["scan:read"],
      allowedIps: [],
      allowedRepositories: [],
      projectId: null,
      identityId: null,
      agentId: null,
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    mocks.getDb.mockResolvedValue({
      insert: () => ({
        values: async (value: Record<string, unknown>) => {
          inserted = value;
        },
      }),
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [row] }),
        }),
      }),
    });

    await createWorkspaceApiKey({
      workspaceId: 2,
      createdByUserId: 7,
      name: "minimal",
    });

    expect(inserted?.scopes).toEqual(["scan:read"]);
  });

  it("fails closed when an IP-restricted key has no observed client IP", async () => {
    const raw = generateRawApiKey("live");
    mocks.getDb.mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "ak_1",
                workspaceId: 2,
                createdByUserId: 7,
                keyHash: hashApiKey(raw),
                scopes: ["gateway:invoke"],
                allowedIps: ["203.0.113.10"],
                allowedRepositories: [],
                projectId: null,
                identityId: null,
                agentId: null,
                revokedAt: null,
                expiresAt: null,
              },
            ],
          }),
        }),
      }),
      update: vi.fn(),
    });

    await expect(
      validateWorkspaceApiKey(raw, { requiredScope: "gateway:invoke" }),
    ).resolves.toBeNull();
  });
});
