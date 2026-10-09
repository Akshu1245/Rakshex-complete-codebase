import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
import { sdk } from "./sdk";
import { createContext } from "./context";

function request(headers: Record<string, string>) {
  return { req: { headers }, res: {} } as Parameters<typeof createContext>[0];
}

describe("authenticated API-key CSRF exemption marker", () => {
  beforeEach(() => vi.mocked(sdk.authenticateRequest).mockReset());

  it("marks a successfully validated x-api-key request", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1 } as any);
    const ctx = await createContext(request({ "x-api-key": "valid-by-sdk" }));
    expect(ctx.apiKeyAuthenticated).toBe(true);
  });

  it("does not trust an invalid API key on its own", async () => {
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("Invalid API key"));
    const ctx = await createContext(request({ "x-api-key": "invalid" }));
    expect(ctx.user).toBeNull();
    expect(ctx.apiKeyAuthenticated).toBe(false);
  });

  it("preserves normal session-cookie CSRF requirements", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1 } as any);
    const ctx = await createContext(request({ cookie: "session=valid" }));
    expect(ctx.apiKeyAuthenticated).toBe(false);
  });

  it("recognizes a valid RaksHex bearer API key path", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1 } as any);
    const ctx = await createContext(request({ authorization: "Bearer rk_test_accepted_by_sdk" }));
    expect(ctx.apiKeyAuthenticated).toBe(true);
  });
});
