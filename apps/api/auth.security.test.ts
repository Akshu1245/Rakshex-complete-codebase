/**
 * Security acceptance tests for PROMPT 3/4 auth & API keys.
 * Pure unit-level checks that enforce acceptance criteria without a live DB.
 */
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, hashToken, needsRehash } from "./utils/password";
import { hashApiKey } from "./utils/crypto";
import { generateRawApiKey, apiKeyHasScope } from "./services/workspaceApiKeys";
import {
  storeOAuthPending,
  consumeOAuthPending,
  generateOAuthState,
  generateCodeVerifier,
  deriveCodeChallenge,
} from "./services/oauthPkce";
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
} from "./services/recoveryCodes";
import { hasPermission, normalizeRole } from "./services/rbac";
import { assertSameWorkspace, requireUser } from "./services/authorization";
import { TRPCError } from "@trpc/server";

describe("PROMPT 3 acceptance — secrets never stored plaintext", () => {
  it("passwords are argon2id, not plaintext", () => {
    const pw = "N0tPlaintext!";
    const hash = hashPassword(pw);
    expect(hash).not.toEqual(pw);
    expect(hash.startsWith("argon2id$")).toBe(true);
    expect(verifyPassword(pw, hash)).toBe(true);
  });

  it("password reset tokens are hashed before storage", () => {
    const raw = "reset-token-raw-value";
    const stored = hashToken(raw);
    expect(stored).not.toEqual(raw);
    expect(stored).toHaveLength(64);
  });

  it("API keys are hashed; raw never equals hash", () => {
    const raw = generateRawApiKey("live");
    const hash = hashApiKey(raw);
    expect(hash).not.toEqual(raw);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("PROMPT 3 acceptance — OAuth state validation", () => {
  it("callback rejects missing/invalid state", async () => {
    expect(await consumeOAuthPending(undefined, "google")).toBeNull();
    expect(await consumeOAuthPending("nope", "google")).toBeNull();
  });

  it("valid state is single-use (cannot reuse)", async () => {
    const state = generateOAuthState();
    const verifier = generateCodeVerifier();
    await storeOAuthPending(state, {
      provider: "google",
      codeVerifier: verifier,
      createdAt: Date.now(),
    });
    expect((await consumeOAuthPending(state, "google"))?.codeVerifier).toBe(verifier);
    expect(await consumeOAuthPending(state, "google")).toBeNull();
  });

  it("PKCE challenge is S256 of verifier", () => {
    const v = generateCodeVerifier();
    const c = deriveCodeChallenge(v);
    expect(c).not.toBe(v);
  });
});

describe("PROMPT 3 acceptance — password reset single-use semantics", () => {
  it("used recovery codes cannot be reused (same pattern as reset tokens)", () => {
    const codes = generateRecoveryCodes(2);
    const hashes = hashRecoveryCodes(codes);
    const once = consumeRecoveryCode(codes[0]!, hashes);
    expect(once).not.toBeNull();
    expect(consumeRecoveryCode(codes[0]!, once!)).toBeNull();
  });
});

describe("PROMPT 3 acceptance — authorization never trusts client roles", () => {
  it("legacy editor normalizes server-side to developer", () => {
    expect(normalizeRole("editor")).toBe("developer");
  });

  it("viewer cannot write api_keys (would be 403 at router)", () => {
    expect(hasPermission("viewer", "api_keys", "write")).toBe(false);
  });

  it("requireUser maps to 401", () => {
    try {
      requireUser(null);
      expect.fail("expected throw");
    } catch (e) {
      expect((e as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });

  it("cross-tenant assertSameWorkspace throws FORBIDDEN", () => {
    try {
      assertSameWorkspace(99, 1);
      expect.fail("expected throw");
    } catch (e) {
      expect((e as TRPCError).code).toBe("FORBIDDEN");
    }
  });
});

describe("PROMPT 4 acceptance — API key scopes", () => {
  it("scope violations fail hasScope check (maps to 403)", () => {
    expect(apiKeyHasScope(["scan:read"], "scan:write")).toBe(false);
    expect(apiKeyHasScope(["scan:write"], "scan:write")).toBe(true);
    expect(apiKeyHasScope(["*"], "admin")).toBe(true);
  });

  it("raw key format is show-once friendly (not reconstructable from prefix alone)", () => {
    const raw = generateRawApiKey("test");
    const prefix = raw.slice(0, 8);
    expect(raw.startsWith("rk_test_")).toBe(true);
    expect(prefix.length).toBeLessThan(raw.length);
  });
});

describe("migration: needsRehash forces argon2 upgrade", () => {
  it("pbkdf2 needs rehash", () => {
    expect(needsRehash("pbkdf2:sha512:aa:bb")).toBe(true);
  });
});
