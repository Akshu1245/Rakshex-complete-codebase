import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext } from "./context";
import { type AppErrorCode, type FormattedTrpcError, isAppError, toTRPCError } from "./errors";
import { generateCsrfToken, verifyCsrfToken } from "../utils/security";
import { trace, SpanStatusCode } from "@opentelemetry/api";

/**
 * tRPC error normalization
 * ────────────────────────
 * Every procedure runs through {@link errorBoundary}, which:
 *
 *   1. Lets {@link TRPCError} pass through unchanged (already structured).
 *   2. Converts any {@link AppError} into a {@link TRPCError} with the
 *      correct typed code + a safe message — see `toTRPCError`.
 *   3. Treats anything else as an unexpected internal error: returns a
 *      generic INTERNAL_SERVER_ERROR to the client and preserves the
 *      original error as `cause` so onError + Sentry get the full stack.
 *
 * Combined with the {@link errorFormatter} below, clients receive a
 * structured payload like:
 *
 *     {
 *       message: "Collection not found",
 *       data: {
 *         code: "NOT_FOUND",
 *         httpStatus: 404,
 *         appCode: "NOT_FOUND",
 *         path: "collections.byId"
 *       }
 *     }
 */
const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }): FormattedTrpcError {
    const cause = error.cause;
    const appCode: AppErrorCode | undefined = isAppError(cause) ? cause.code : undefined;

    // Surface zod issues only for validation failures so the client
    // can render per-field errors. Everything else goes to logs.
    const zodIssues = cause instanceof ZodError ? cause.flatten() : undefined;

    return {
      ...shape,
      data: {
        ...shape.data,
        appCode,
        zodIssues,
      },
    };
  },
});

const errorBoundary = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    // Already structured — re-throw untouched.
    if (err instanceof TRPCError) throw err;
    // Domain error → typed TRPCError. Unknown error → safe 500.
    throw toTRPCError(err);
  }
});

/* ─── CSRF Protection ──────────────────────────────────────────────────── */

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Procedures that are exempt from CSRF verification. These are public
 * endpoints that don't require an authenticated session, or webhook
 * receivers that use their own signature verification.
 */
const CSRF_EXEMPT_PATHS = new Set([
  "auth.login",
  "auth.signup",
  "auth.forgotPassword",
  "auth.resetPassword",
  "auth.me",
  "payment.handleWebhook",
  "sso.resolveByEmailDomain",
]);

/**
 * CSRF middleware: verifies that mutating (non-query) tRPC procedures
 * include a valid CSRF token. The token is set as a non-HttpOnly cookie
 * on login/signup so JavaScript can read it and send it back as a
 * custom header (`x-csrf-token`). This is the double-submit cookie
 * pattern — prevents CSRF attacks without requiring server-side session
 * storage for the token.
 *
 * Skipped for:
 *   - Query procedures (safe, idempotent reads)
 *   - Exempt public routes (login, signup, password reset, webhooks)
 *   - Requests using API key authentication (VS Code extension, CLI)
 */
const csrfMiddleware = t.middleware(async (opts) => {
  const { ctx, next, type, path } = opts;

  // Only verify CSRF on mutations (not queries)
  if (type !== "mutation") {
    return next();
  }

  // Skip CSRF for exempt paths
  if (CSRF_EXEMPT_PATHS.has(path)) {
    return next();
  }

  // Skip CSRF for API-key-authenticated requests (the key itself is the
  // secret — browsers can't set custom headers cross-origin without CORS).
  const apiKey = ctx.req.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey.length > 0) {
    return next();
  }

  // Read the CSRF token from the cookie and the header
  const cookieToken = parseCookieValue(ctx.req.headers.cookie ?? "", CSRF_COOKIE_NAME);
  const headerToken = ctx.req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CSRF token mismatch — please refresh and try again",
    });
  }

  return next();
});

/**
 * Parse a specific cookie value from the cookie header string.
 */
function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  const prefix = `${name}=`;
  const cookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  return cookie?.slice(prefix.length);
}

/**
 * Generate a new CSRF token and set it as a cookie on the response.
 * Call this on login/signup to bootstrap the CSRF protection cycle.
 */
export function setCsrfCookie(res: {
  cookie: (name: string, value: string, options: Record<string, unknown>) => void;
}): string {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

export const router = t.router;

/**
 * OpenTelemetry tracing middleware — creates a span per tRPC procedure call.
 * Span name: "trpc.{type}.{path}" (e.g. "trpc.mutation.auth.login").
 *
 * Attributes recorded (never PII):
 *   - procedure type + path
 *   - userId (when authenticated)
 *   - error status on failure
 */
const otelMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const span = trace.getTracer("devpulse-trpc").startSpan(`trpc.${type}.${path}`);
  try {
    span.setAttribute("trpc.type", type);
    span.setAttribute("trpc.path", path);
    if (ctx.user?.id) {
      span.setAttribute("user.id", ctx.user.id);
    }
    const result = await next();
    span.end();
    return result;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    span.recordException(err instanceof Error ? err : new Error(String(err)));
    span.end();
    throw err;
  }
});

/**
 * Public procedure. Anyone (logged in or not) may call it. The error
 * boundary still runs so unexpected throws don't leak internals.
 * CSRF protection is applied to mutations.
 */
export const publicProcedure = t.procedure
  .use(otelMiddleware)
  .use(errorBoundary)
  .use(csrfMiddleware);

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure
  .use(errorBoundary)
  .use(csrfMiddleware)
  .use(requireUser);

export const editorProcedure = t.procedure
  .use(errorBoundary)
  .use(csrfMiddleware)
  .use(
    t.middleware(async (opts) => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      if (ctx.user.role !== "admin" && ctx.user.role !== "editor") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Collection not found or access denied",
        });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );

export const adminProcedure = t.procedure
  .use(errorBoundary)
  .use(csrfMiddleware)
  .use(
    t.middleware(async (opts) => {
      const { ctx, next } = opts;

      if (!ctx.user || ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );
