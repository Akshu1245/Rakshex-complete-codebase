// @ts-nocheck
import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import type { Request } from "express";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    protocol: "https",
    hostname: "app.devpulse.in",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

describe("getSessionCookieOptions", () => {
  it("sets secure=true for HTTPS requests", () => {
    const req = mockReq({ protocol: "https" });
    const opts = getSessionCookieOptions(req);
    expect(opts.secure).toBe(true);
  });

  it("sets secure=false for HTTP requests", () => {
    const req = mockReq({ protocol: "http" });
    const opts = getSessionCookieOptions(req);
    expect(opts.secure).toBe(false);
  });

  it("sets httpOnly=true always", () => {
    const req = mockReq();
    const opts = getSessionCookieOptions(req);
    expect(opts.httpOnly).toBe(true);
  });

  it("sets path='/' always", () => {
    const req = mockReq();
    const opts = getSessionCookieOptions(req);
    expect(opts.path).toBe("/");
  });

  it("uses sameSite=lax for same-origin requests", () => {
    const req = mockReq({
      protocol: "https",
      hostname: "app.devpulse.in",
      headers: { origin: "https://app.devpulse.in" },
    });
    const opts = getSessionCookieOptions(req);
    expect(opts.sameSite).toBe("lax");
  });

  it("uses sameSite=none for cross-origin HTTPS requests", () => {
    const req = mockReq({
      protocol: "https",
      hostname: "api.devpulse.in",
      headers: {
        origin: "https://app.devpulse.in",
        "x-forwarded-proto": "https",
      },
    });
    const opts = getSessionCookieOptions(req);
    expect(opts.sameSite).toBe("none");
  });

  it("uses sameSite=lax for cross-origin HTTP requests", () => {
    const req = mockReq({
      protocol: "http",
      hostname: "api.devpulse.in",
      headers: { origin: "https://app.devpulse.in" },
    });
    const opts = getSessionCookieOptions(req);
    expect(opts.sameSite).toBe("lax");
  });

  it("sets domain for non-localhost hostnames", () => {
    const req = mockReq({ hostname: "app.devpulse.in" });
    const opts = getSessionCookieOptions(req);
    expect(opts.domain).toBe(".app.devpulse.in");
  });

  it("does not set domain for localhost", () => {
    const req = mockReq({ hostname: "localhost" });
    const opts = getSessionCookieOptions(req);
    expect(opts.domain).toBeUndefined();
  });

  it("does not set domain for IP address", () => {
    const req = mockReq({ hostname: "127.0.0.1" });
    const opts = getSessionCookieOptions(req);
    expect(opts.domain).toBeUndefined();
  });

  it("detects secure via x-forwarded-proto header", () => {
    const req = mockReq({
      protocol: "http",
      headers: { "x-forwarded-proto": "https" },
    });
    const opts = getSessionCookieOptions(req);
    expect(opts.secure).toBe(true);
  });

  it("handles subdomain origin as same-origin", () => {
    const req = mockReq({
      protocol: "https",
      hostname: "devpulse.in",
      headers: { origin: "https://app.devpulse.in" },
    });
    const opts = getSessionCookieOptions(req);
    expect(opts.sameSite).toBe("lax");
  });
});
