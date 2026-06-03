// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { registerGitHubOAuthRoutes } from "./_core/githubOAuth";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    protocol: "https",
    hostname: "app.rakshex.in",
    headers: { "x-forwarded-proto": "https", host: "app.rakshex.in" },
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes() {
  const cookies: Record<string, unknown>[] = [];
  const cleared: string[] = [];
  const redirects: string[] = [];
  let _status = 200;
  let _body: unknown = null;

  const res = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ name, value, ...options });
      return res;
    },
    clearCookie(name: string) {
      cleared.push(name);
      return res;
    },
    redirect(code: number, url: string) {
      redirects.push(url);
      return res;
    },
    status(code: number) {
      _status = code;
      return {
        json(data: unknown) {
          _body = data;
        },
      };
    },
    json(data: unknown) {
      _body = data;
      return res;
    },
  } as unknown as Response;

  return {
    res,
    cookies,
    cleared,
    redirects,
    getStatus: () => _status,
    getBody: () => _body,
  };
}

function getHandler(path: string) {
  const app = { get: vi.fn() } as any;
  registerGitHubOAuthRoutes(app);
  return app.get.mock.calls.find((c: any[]) => c[0] === path)?.[1];
}

describe("github oauth", () => {
  it("registers the GitHub OAuth routes", () => {
    const app = { get: vi.fn() } as any;
    registerGitHubOAuthRoutes(app);
    expect(app.get).toHaveBeenCalledWith("/api/oauth/github", expect.any(Function));
    expect(app.get).toHaveBeenCalledWith("/api/oauth/github/callback", expect.any(Function));
  });

  it("returns 503 from /api/oauth/github when not configured", () => {
    const handler = getHandler("/api/oauth/github");
    const req = mockReq();
    const result = mockRes();
    handler(req, result.res);
    expect(result.getStatus()).toBe(503);
  });

  it("returns 400 from callback when code is missing", async () => {
    const handler = getHandler("/api/oauth/github/callback");
    const req = mockReq({ query: {} });
    const result = mockRes();
    await handler(req, result.res);
    expect(result.getStatus()).toBe(400);
  });

  it("redirects to error on state mismatch", async () => {
    const handler = getHandler("/api/oauth/github/callback");
    const req = mockReq({
      query: { code: "abc", state: "evil" },
      headers: { cookie: "rakshex_gh_oauth_state=expected" },
    });
    const result = mockRes();
    await handler(req, result.res);
    expect(result.redirects).toContain("/?error=github_auth_failed");
  });

  it("redirects to denied error when user denies access", async () => {
    const handler = getHandler("/api/oauth/github/callback");
    const req = mockReq({ query: { error: "access_denied" } });
    const result = mockRes();
    await handler(req, result.res);
    expect(result.redirects).toContain("/?error=github_auth_denied");
  });
});
