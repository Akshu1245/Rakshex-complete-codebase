import { describe, expect, it } from "vitest";
import { router, protectedProcedure } from "./trpc";
import { generateCsrfToken } from "../utils/security";
import type { TrpcContext } from "./context";

const testRouter = router({ write: protectedProcedure.mutation(() => "ok") });

function context(headers: Record<string, string>, apiKeyAuthenticated = false): TrpcContext {
  return {
    user: { id: 1 } as NonNullable<TrpcContext["user"]>,
    req: { headers } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    apiKeyAuthenticated,
  };
}

describe("CSRF must not trust arbitrary API-key header presence", () => {
  it("rejects mutations with only an unverified x-api-key header", async () => {
    const caller = testRouter.createCaller(context({ "x-api-key": "forged", cookie: "session=valid" }));
    await expect(caller.write()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("accepts authenticated SDK API-key requests without CSRF", async () => {
    const caller = testRouter.createCaller(context({ "x-api-key": "validated-by-sdk" }, true));
    await expect(caller.write()).resolves.toBe("ok");
  });
  it("continues accepting valid cookie-backed CSRF tokens", async () => {
    const csrf = generateCsrfToken();
    const caller = testRouter.createCaller(context({ cookie: `csrf-token=${csrf}`, "x-csrf-token": csrf }));
    await expect(caller.write()).resolves.toBe("ok");
  });
});
