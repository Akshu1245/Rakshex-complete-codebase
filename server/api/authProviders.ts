/**
 * Public endpoint: which authentication providers are available?
 * The frontend uses this to decide whether to show Google OAuth buttons.
 */
import { router, publicProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";

export const authProvidersRouter = router({
  list: publicProcedure.query(() => ({
    // Sign-up/sign-in is OAuth-only (GitHub + Google).
    emailPassword: false,
    google: Boolean(ENV.googleClientId && ENV.googleClientSecret),
    github: Boolean(ENV.githubClientId && ENV.githubClientSecret),
  })),
});
