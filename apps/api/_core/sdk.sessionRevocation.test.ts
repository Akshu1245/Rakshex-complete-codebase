/**
 * Session revocation binding: access JWT must be rejected when the
 * server-side user_sessions row is revoked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({
  getActiveUserSessionById: vi.fn(),
  getUserById: vi.fn(),
  getUserByApiKey: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./tokens", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("./env", () => ({
  ENV: {
    cookieSecret: "test-secret-at-least-32-chars-long!!",
    appId: "test-app",
    oAuthServerUrl: "https://auth.example.com",
  },
}));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as db from "../db";
import { verifyAccessToken } from "./tokens";
import { sdk } from "./sdk";
import { HttpError } from "@rakshex/shared-types";
import { ACCESS_TOKEN_COOKIE } from "@rakshex/shared-types/const";

function mockReq(cookie: string) {
  return {
    headers: { cookie, authorization: undefined },
    ip: "127.0.0.1",
  } as any;
}

describe("sdk authenticateRequest session revocation", () => {
  beforeEach(() => {
    vi.mocked(verifyAccessToken).mockReset();
    vi.mocked(db.getActiveUserSessionById).mockReset();
    vi.mocked(db.getUserById).mockReset();
  });

  it("rejects access token when session is revoked", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: 1,
      sessionId: "sess_revoked",
      type: "access",
    });
    vi.mocked(db.getActiveUserSessionById).mockResolvedValue(null);

    await expect(
      sdk.authenticateRequest(mockReq(`${ACCESS_TOKEN_COOKIE}=valid.jwt.token`)),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("accepts access token when session is active", async () => {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: 1,
      sessionId: "sess_ok",
      type: "access",
    });
    vi.mocked(db.getActiveUserSessionById).mockResolvedValue({
      id: "sess_ok",
      userId: 1,
      isRevoked: false,
    } as any);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 1,
      email: "a@example.com",
      openId: "oid",
    } as any);

    const user = await sdk.authenticateRequest(mockReq(`${ACCESS_TOKEN_COOKIE}=valid.jwt.token`));
    expect(user.id).toBe(1);
    expect(db.getActiveUserSessionById).toHaveBeenCalledWith("sess_ok");
  });
});
