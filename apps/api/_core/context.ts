import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "@rakshex/database";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** Set only after sdk.authenticateRequest successfully authenticates an API key. */
  apiKeyAuthenticated?: boolean;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    // SDK rejects invalid API-key credentials instead of falling back to cookie auth.
    // Header presence alone NEVER grants a CSRF exemption.
    apiKeyAuthenticated: Boolean(
      user &&
        ((typeof opts.req.headers["x-api-key"] === "string" &&
          opts.req.headers["x-api-key"].trim().length > 0) ||
          (typeof opts.req.headers.authorization === "string" &&
            /^Bearer\s+(?:rk_live_|rk_test_|dp_)/i.test(opts.req.headers.authorization))),
    ),
  };
}
