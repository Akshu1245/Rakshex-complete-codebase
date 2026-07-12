import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateRawApiKey, apiKeyHasScope } from "./workspaceApiKeys";
import { hashApiKey } from "../utils/crypto";

describe("API key helpers", () => {
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
});
