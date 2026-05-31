/**
 * Public endpoint: which authentication providers are available?
 * The frontend uses this to decide whether to show Google OAuth buttons.
 */
import { router, publicProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";

export const authProvidersRouter = router({
  list: publicProcedure.query(() => ({
    emailPassword: true,
    google: Boolean(ENV.googleClientId && ENV.googleClientSecret),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  })),
});
