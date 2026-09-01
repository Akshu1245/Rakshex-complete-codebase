import { describe, expect, it } from "vitest";
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateOAuthState,
  normalizeRedirectAfter,
  storeOAuthPending,
  consumeOAuthPending,
} from "./oauthPkce";

describe("OAuth PKCE + state", () => {
  it("generates verifier and S256 challenge", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    const c = deriveCodeChallenge(v);
    expect(c).not.toBe(v);
    expect(c.length).toBeGreaterThan(20);
  });

  it("state is single-use and provider-bound", async () => {
    const state = generateOAuthState();
    const verifier = generateCodeVerifier();
    await storeOAuthPending(state, {
      provider: "github",
      codeVerifier: verifier,
      createdAt: Date.now(),
    });
    const ok = await consumeOAuthPending(state, "github");
    expect(ok?.codeVerifier).toBe(verifier);
    expect(await consumeOAuthPending(state, "github")).toBeNull();
  });

  it("rejects wrong provider", async () => {
    const state = generateOAuthState();
    await storeOAuthPending(state, {
      provider: "google",
      codeVerifier: generateCodeVerifier(),
      createdAt: Date.now(),
    });
    expect(await consumeOAuthPending(state, "github")).toBeNull();
  });

  it("rejects missing state", async () => {
    expect(await consumeOAuthPending(undefined, "google")).toBeNull();
    expect(await consumeOAuthPending("short", "google")).toBeNull();
  });

  it("allows only same-origin relative post-login redirects", () => {
    expect(normalizeRedirectAfter("/dashboard")).toBe("/dashboard");
    expect(normalizeRedirectAfter("/workspace?tab=agents#latest")).toBe(
      "/workspace?tab=agents#latest",
    );
    expect(normalizeRedirectAfter("https://evil.example/steal")).toBeUndefined();
    expect(normalizeRedirectAfter("//evil.example/steal")).toBeUndefined();
    expect(normalizeRedirectAfter("/\\evil.example/steal")).toBeUndefined();
    expect(normalizeRedirectAfter("/dashboard%0d%0aSet-Cookie:bad=1")).toBeUndefined();
  });

  it("normalizes unsafe stored redirect values before returning state", async () => {
    const state = generateOAuthState();
    await storeOAuthPending(state, {
      provider: "google",
      codeVerifier: generateCodeVerifier(),
      redirectAfter: "https://evil.example/steal",
      createdAt: Date.now(),
    });
    const result = await consumeOAuthPending(state, "google");
    expect(result).not.toBeNull();
    expect(result?.redirectAfter).toBeUndefined();
  });
});
