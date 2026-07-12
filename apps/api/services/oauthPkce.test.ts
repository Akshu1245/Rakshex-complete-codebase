import { describe, expect, it } from "vitest";
import {
  generateCodeVerifier,
  deriveCodeChallenge,
  generateOAuthState,
  storeOAuthPending,
  consumeOAuthPending,
} from "./oauthPkce";

describe("OAuth PKCE + state", () => {
  it("generates verifier and S256 challenge", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThan(20);
    const c = deriveCodeChallenge(v);
    expect(c).not.toBe(v);
    expect(c.length).toBeGreaterThan(20);
  });

  it("state is single-use and provider-bound", async () => {
    const state = generateOAuthState();
    await storeOAuthPending(state, {
      provider: "github",
      codeVerifier: "verifier-xyz",
      createdAt: Date.now(),
    });
    const ok = await consumeOAuthPending(state, "github");
    expect(ok?.codeVerifier).toBe("verifier-xyz");
    // Second consume fails
    expect(await consumeOAuthPending(state, "github")).toBeNull();
  });

  it("rejects wrong provider", async () => {
    const state = generateOAuthState();
    await storeOAuthPending(state, {
      provider: "google",
      codeVerifier: "v",
      createdAt: Date.now(),
    });
    expect(await consumeOAuthPending(state, "github")).toBeNull();
  });

  it("rejects missing state", async () => {
    expect(await consumeOAuthPending(undefined, "google")).toBeNull();
    expect(await consumeOAuthPending("short", "google")).toBeNull();
  });
});
