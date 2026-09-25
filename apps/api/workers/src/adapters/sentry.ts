/**
 * Sentry for Workers — replaces @sentry/node (apps/api/_core/sentry.ts).
 *
 * @sentry/cloudflare is the official Workers build; it flushes via waitUntil
 * instead of a Node process exit hook. Init is lazy and optional: no DSN, no
 * Sentry, no throw.
 */
import type { Env } from "../env";

type SentryLike = {
  captureException: (err: unknown) => void;
  withScope?: (fn: (scope: { setContext: (k: string, v: unknown) => void }) => void) => void;
};

type SentryModule = {
  init?: (options: Record<string, unknown>) => void;
  captureException?: (err: unknown) => void;
  withScope?: SentryLike["withScope"];
  default?: SentryModule;
};

let cached: SentryLike | null | undefined;

async function loadSentry(env: Env): Promise<SentryLike | null> {
  if (cached !== undefined) return cached;
  if (!env.SENTRY_DSN) {
    cached = null;
    return null;
  }
  try {
    const raw = (await import("@sentry/cloudflare")) as SentryModule;
    const mod = raw.default ?? raw;
    mod.init?.({
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT ?? "production",
      tracesSampleRate: 0.1,
    });
    cached = {
      captureException: (err: unknown) => mod.captureException?.(err),
      withScope: mod.withScope,
    };
  } catch {
    cached = null;
  }
  return cached;
}

export async function captureError(
  env: Env,
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  console.error("[sentry]", err instanceof Error ? err.message : String(err), context ?? {});
  const sentry = await loadSentry(env);
  if (!sentry) return;
  try {
    if (context && sentry.withScope) {
      sentry.withScope((scope) => {
        scope.setContext("workers", context);
        sentry.captureException(err);
      });
    } else {
      sentry.captureException(err);
    }
  } catch {
    // Sentry must never break the request path.
  }
}
