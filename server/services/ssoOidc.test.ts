// @ts-nocheck  
import { Buffer } from "buffer";
import { describe, expect, it, vi } from "vitest";

import {
  buildAuthorizeUrl,
  decodeIdToken,
  deriveCodeChallenge,
  exchangeCodeForTokens,
  generateCodeVerifier,
  generateNonce,
  generateState,
  validateClaims,
  type OidcConfig,
} from "./ssoOidc";

const CONFIG: OidcConfig = {
  issuer: "https://idp.example.com",
  clientId: "client-abc",
  clientSecret: "secret-xyz",
  scopes: "openid profile email",
};

function makeIdToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature-not-verified`;
}

describe("PKCE helpers", () => {
  it("generates code verifiers and challenges with the right shape", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    const c = deriveCodeChallenge(v);
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(c.length).toBeGreaterThanOrEqual(43);
  });

  it("derives the same challenge for the same verifier", () => {
    const v = "my-fixed-verifier-1234567890abcdefABCDEF";
    expect(deriveCodeChallenge(v)).toBe(deriveCodeChallenge(v));
  });

  it("generates state and nonce that look unique", () => {
    const states = new Set<string>();
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      states.add(generateState());
      nonces.add(generateNonce());
    }
    expect(states.size).toBe(100);
    expect(nonces.size).toBe(100);
  });
});

describe("buildAuthorizeUrl", () => {
  it("emits a well-formed authorize URL with PKCE", () => {
    const url = buildAuthorizeUrl(CONFIG, {
      redirectUri: "https://app.example.com/auth/sso/1/callback",
      state: "STATE",
      nonce: "NONCE",
      codeChallenge: "CHAL",
    });
    const u = new URL(url);
    expect(u.origin).toBe("https://idp.example.com");
    expect(u.pathname).toBe("/authorize");
    expect(u.searchParams.get("client_id")).toBe("client-abc");
    expect(u.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/auth/sso/1/callback"
    );
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBe("openid profile email");
    expect(u.searchParams.get("state")).toBe("STATE");
    expect(u.searchParams.get("code_challenge")).toBe("CHAL");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("uses an explicit authorizationEndpoint when provided", () => {
    const url = buildAuthorizeUrl(
      { ...CONFIG, authorizationEndpoint: "https://idp.example.com/auth" },
      {
        redirectUri: "https://x/cb",
        state: "s",
        nonce: "n",
        codeChallenge: "c",
      }
    );
    expect(new URL(url).pathname).toBe("/auth");
  });
});

describe("exchangeCodeForTokens", () => {
  it("posts to the token endpoint and parses the response", async () => {
    const fakeFetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "AT",
            id_token: "ID",
            refresh_token: "RT",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "openid profile email",
          }),
        }) as unknown as Response
    );
    const tokens = await exchangeCodeForTokens(
      CONFIG,
      {
        redirectUri: "https://app/cb",
        code: "AUTHCODE",
        codeVerifier: "VERIFIER",
      },
      fakeFetch as unknown as typeof fetch
    );
    expect(tokens.accessToken).toBe("AT");
    expect(tokens.idToken).toBe("ID");
    expect(tokens.refreshToken).toBe("RT");
    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = fakeFetch.mock.calls[0]!;
    expect(url).toBe("https://idp.example.com/token");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as string;
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=AUTHCODE");
    expect(body).toContain("code_verifier=VERIFIER");
    expect(body).toContain("client_id=client-abc");
    expect(body).toContain("client_secret=secret-xyz");
  });

  it("throws on non-2xx", async () => {
    const fakeFetch = vi.fn(
      async () =>
        ({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => '{"error":"invalid_grant"}',
        }) as unknown as Response
    );
    await expect(
      exchangeCodeForTokens(
        CONFIG,
        { redirectUri: "x", code: "y", codeVerifier: "z" },
        fakeFetch as unknown as typeof fetch
      )
    ).rejects.toThrow(/OIDC token exchange failed/);
  });

  it("throws on malformed JSON response", async () => {
    const fakeFetch = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ token_type: "Bearer" }),
        }) as unknown as Response
    );
    await expect(
      exchangeCodeForTokens(
        CONFIG,
        { redirectUri: "x", code: "y", codeVerifier: "z" },
        fakeFetch as unknown as typeof fetch
      )
    ).rejects.toThrow(/missing access_token/);
  });
});

describe("decodeIdToken", () => {
  it("decodes a well-formed token", () => {
    const claims = decodeIdToken(
      makeIdToken({
        sub: "user-1",
        iss: CONFIG.issuer,
        aud: CONFIG.clientId,
        email: "user@example.com",
      })
    );
    expect(claims.sub).toBe("user-1");
    expect(claims.email).toBe("user@example.com");
  });

  it("rejects tokens with the wrong segment count", () => {
    expect(() => decodeIdToken("only.two")).toThrow(/three JWT segments/);
  });

  it("rejects tokens with non-JSON payloads", () => {
    expect(() => decodeIdToken("a.notbase64.c")).toThrow();
  });

  it("rejects tokens missing required claims", () => {
    expect(() =>
      decodeIdToken(makeIdToken({ iss: "x", aud: "y" }))
    ).toThrow(/'sub' claim/);
    expect(() =>
      decodeIdToken(makeIdToken({ sub: "x", aud: "y" }))
    ).toThrow(/'iss' claim/);
    expect(() =>
      decodeIdToken(makeIdToken({ sub: "x", iss: "y" }))
    ).toThrow(/'aud' claim/);
  });
});

describe("validateClaims", () => {
  const baseClaims = {
    sub: "user-1",
    iss: CONFIG.issuer,
    aud: CONFIG.clientId,
    nonce: "NONCE",
    iat: 1_700_000_000,
    exp: 1_700_001_000,
  };

  it("accepts matching claims", () => {
    expect(() =>
      validateClaims(baseClaims, {
        expectedIssuer: CONFIG.issuer,
        expectedAudience: CONFIG.clientId,
        expectedNonce: "NONCE",
        now: 1_700_000_500,
      })
    ).not.toThrow();
  });

  it("rejects issuer mismatch", () => {
    expect(() =>
      validateClaims(baseClaims, {
        expectedIssuer: "https://wrong",
        expectedAudience: CONFIG.clientId,
        now: 1_700_000_500,
      })
    ).toThrow(/issuer mismatch/);
  });

  it("rejects audience mismatch", () => {
    expect(() =>
      validateClaims(baseClaims, {
        expectedIssuer: CONFIG.issuer,
        expectedAudience: "other",
        now: 1_700_000_500,
      })
    ).toThrow(/audience mismatch/);
  });

  it("rejects nonce mismatch", () => {
    expect(() =>
      validateClaims(baseClaims, {
        expectedIssuer: CONFIG.issuer,
        expectedAudience: CONFIG.clientId,
        expectedNonce: "WRONG",
        now: 1_700_000_500,
      })
    ).toThrow(/nonce mismatch/);
  });

  it("rejects expired tokens", () => {
    expect(() =>
      validateClaims(baseClaims, {
        expectedIssuer: CONFIG.issuer,
        expectedAudience: CONFIG.clientId,
        now: 1_700_002_000,
      })
    ).toThrow(/expired/);
  });

  it("accepts array audiences when one matches", () => {
    expect(() =>
      validateClaims(
        { ...baseClaims, aud: ["other", CONFIG.clientId] },
        {
          expectedIssuer: CONFIG.issuer,
          expectedAudience: CONFIG.clientId,
          now: 1_700_000_500,
        }
      )
    ).not.toThrow();
  });
});
