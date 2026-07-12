// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { registerOAuthRoutes } from "./_core/oauth";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    protocol: "https",
    hostname: "app.rakshex.in",
    headers: { "x-forwarded-proto": "https" },
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): {
  res: Response;
  cookies: Record<string, unknown>[];
  redirects: string[];
  getStatus: () => number;
  getBody: () => unknown;
} {
  const cookies: Record<string, unknown>[] = [];
  const redirects: string[] = [];
  let _status = 200;
  let _body: unknown = null;

  const res = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ name, value, ...options });
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
        send(data: unknown) {
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
    redirects,
    getStatus: () => _status,
    getBody: () => _body,
  };
}

describe("oauth callback", () => {
  it("returns 400 when code parameter is missing", async () => {
    const req = mockReq({ query: { state: "abc" } });
    const result = mockRes();

    const app = { get: vi.fn() } as any;
    registerOAuthRoutes(app);
    const handler = app.get.mock.calls.find((c: any[]) => c[0] === "/api/oauth/callback")?.[1];

    if (handler) {
      await handler(req, result.res);
      expect(result.getStatus()).toBe(400);
      expect(result.getBody()).toEqual({ error: "code and state are required" });
    }
  });

  it("returns 400 when state parameter is missing", async () => {
    const req = mockReq({ query: { code: "xyz" } });
    const result = mockRes();

    const app = { get: vi.fn() } as any;
    registerOAuthRoutes(app);
    const handler = app.get.mock.calls.find((c: any[]) => c[0] === "/api/oauth/callback")?.[1];

    if (handler) {
      await handler(req, result.res);
      expect(result.getStatus()).toBe(400);
      expect(result.getBody()).toEqual({ error: "code and state are required" });
    }
  });

  it("returns 400 when both code and state are missing", async () => {
    const req = mockReq({ query: {} });
    const result = mockRes();

    const app = { get: vi.fn() } as any;
    registerOAuthRoutes(app);
    const handler = app.get.mock.calls.find((c: any[]) => c[0] === "/api/oauth/callback")?.[1];

    if (handler) {
      await handler(req, result.res);
      expect(result.getStatus()).toBe(400);
    }
  });

  it("registers the OAuth callback route", () => {
    const app = { get: vi.fn() } as any;
    registerOAuthRoutes(app);
    expect(app.get).toHaveBeenCalledWith("/api/oauth/callback", expect.any(Function));
  });
});
