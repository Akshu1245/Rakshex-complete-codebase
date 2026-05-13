/**
 * Typed domain errors for the DevPulse server.
 *
 * Why this file exists
 * ────────────────────
 * Throwing raw `Error` objects from business logic has three problems in a
 * production system:
 *
 *   1. The transport layer (tRPC, Express) cannot distinguish between an
 *      "expected" failure (record not found, bad input) and a "this should
 *      never happen" failure (DB offline, programmer bug). Everything ends
 *      up as INTERNAL_SERVER_ERROR.
 *
 *   2. The client receives a leaky stack trace or a generic 500, neither of
 *      which is helpful. We want clients to see a stable error code +
 *      safe message, and we want operators to see the full context in
 *      Sentry / pino.
 *
 *   3. There is no way to attach structured context (orgId, requestId,
 *      affected resource) to an error in a way that survives serialization.
 *
 * Design
 * ──────
 *  • {@link AppError} is the common base class. Every domain error in this
 *    file extends it. Each one declares:
 *       - `code`         — stable machine-readable identifier
 *       - `httpStatus`   — for raw Express handlers
 *       - `trpcCode`     — for tRPC handlers
 *       - `safeMessage`  — what we are willing to show end-users
 *       - `context`      — non-sensitive structured data for logs
 *
 *  • Anything not derived from {@link AppError} is considered an
 *    *unexpected* error. The {@link toTRPCError} normalizer maps it to
 *    INTERNAL_SERVER_ERROR with a generic safe message — never leaking the
 *    raw Error.message to the client. The original error is preserved as
 *    `cause` so Sentry still gets the full picture.
 *
 *  • {@link assertDb} is a tiny helper used pervasively in `server/db.ts`
 *    to replace the previous pattern:
 *
 *        if (!db) throw new Error("Database not available");
 *
 *    with a typed, narrowed assertion that produces a
 *    {@link DatabaseUnavailableError}.
 */

import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/unstable-core-do-not-import";

// ─────────────────────────────────────────────────────────────────────────
// Base class
// ─────────────────────────────────────────────────────────────────────────

export type AppErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BILLING_REQUIRED"
  | "BILLING_PROVIDER_ERROR"
  | "EXTERNAL_SERVICE_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "RUNTIME_POLICY_VIOLATION"
  | "AI_THREAT_DETECTED"
  | "INTERNAL";

export interface AppErrorOptions {
  /** Non-sensitive structured data attached to logs. */
  context?: Record<string, unknown>;
  /** Original error wrapped by this one (for Sentry / pino). */
  cause?: unknown;
  /** Override the default safe message exposed to clients. */
  safeMessage?: string;
}

/**
 * Base class for every domain error in the application.
 *
 * Concrete subclasses set `code`, `httpStatus`, `trpcCode`, and the
 * default `safeMessage`. Callers can override `safeMessage` per-throw
 * when they need to surface a more specific message to the user.
 */
export abstract class AppError extends Error {
  public abstract readonly code: AppErrorCode;
  public abstract readonly httpStatus: number;
  public abstract readonly trpcCode: TRPC_ERROR_CODE_KEY;
  public readonly safeMessage: string;
  public readonly context: Record<string, unknown>;
  public readonly isAppError = true as const;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.safeMessage = options.safeMessage ?? message;
    this.context = options.context ?? {};
  }

  /**
   * Serialize for structured logging. Never include `message` if it
   * might contain user input — `safeMessage` is the public-facing one.
   */
  toJSON(): {
    name: string;
    code: AppErrorCode;
    httpStatus: number;
    trpcCode: TRPC_ERROR_CODE_KEY;
    message: string;
    safeMessage: string;
    context: Record<string, unknown>;
  } {
    return {
      name: this.name,
      code: this.code,
      httpStatus: this.httpStatus,
      trpcCode: this.trpcCode,
      message: this.message,
      safeMessage: this.safeMessage,
      context: this.context,
    };
  }
}

export function isAppError(err: unknown): err is AppError {
  return (
    err instanceof AppError ||
    (typeof err === "object" &&
      err !== null &&
      (err as { isAppError?: unknown }).isAppError === true)
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Concrete domain errors
// ─────────────────────────────────────────────────────────────────────────

/** Generic input validation failure. Use ValidationError when zod fails. */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_FAILED";
  readonly httpStatus = 400;
  readonly trpcCode = "BAD_REQUEST" as const;
}

/** Caller is not authenticated at all. */
export class AuthError extends AppError {
  readonly code: AppErrorCode = "UNAUTHENTICATED";
  readonly httpStatus: number = 401;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = "UNAUTHORIZED";
}

export class InvalidCredentialsError extends AuthError {
  override readonly code = "INVALID_CREDENTIALS";
}

export class SessionExpiredError extends AuthError {
  override readonly code = "SESSION_EXPIRED";
}

/** Caller is authenticated but lacks permission for this action / resource. */
export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
  readonly httpStatus = 403;
  readonly trpcCode = "FORBIDDEN" as const;
}

/** Resource does not exist (or caller lacks read access — same response). */
export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;
  readonly trpcCode = "NOT_FOUND" as const;
}

/** Unique constraint violation, idempotency replay, etc. */
export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;
  readonly trpcCode = "CONFLICT" as const;
}

/** Rate limit exhausted. */
export class RateLimitError extends AppError {
  readonly code = "RATE_LIMITED";
  readonly httpStatus = 429;
  readonly trpcCode = "TOO_MANY_REQUESTS" as const;
}

/** Action requires a paid plan / outstanding invoice / quota. */
export class BillingError extends AppError {
  readonly code: AppErrorCode = "BILLING_REQUIRED";
  readonly httpStatus: number = 402;
  readonly trpcCode: TRPC_ERROR_CODE_KEY = "FORBIDDEN";
}

/** Razorpay / Stripe / etc. returned an error we cannot recover from. */
export class BillingProviderError extends BillingError {
  override readonly code = "BILLING_PROVIDER_ERROR";
  override readonly httpStatus = 502;
  override readonly trpcCode = "INTERNAL_SERVER_ERROR" as const;
}

/** Generic upstream HTTP / external API failure. */
export class ExternalServiceError extends AppError {
  readonly code = "EXTERNAL_SERVICE_ERROR";
  readonly httpStatus = 502;
  readonly trpcCode = "INTERNAL_SERVER_ERROR" as const;
}

/**
 * MySQL connection is not configured or is currently unreachable. This is
 * a deliberately distinct class so we can alarm specifically on it and
 * differentiate from generic 500s.
 */
export class DatabaseUnavailableError extends AppError {
  readonly code = "DATABASE_UNAVAILABLE";
  readonly httpStatus = 503;
  readonly trpcCode = "INTERNAL_SERVER_ERROR" as const;

  constructor(operation?: string, options: AppErrorOptions = {}) {
    super(
      operation
        ? `Database not available for operation: ${operation}`
        : "Database not available",
      {
        ...options,
        safeMessage:
          options.safeMessage ??
          "The service is temporarily unavailable. Please try again shortly.",
        context: {
          ...(options.context ?? {}),
          ...(operation ? { operation } : {}),
        },
      }
    );
  }
}

/** Runtime governance policy refused to execute the requested action. */
export class RuntimePolicyError extends AppError {
  readonly code = "RUNTIME_POLICY_VIOLATION";
  readonly httpStatus = 403;
  readonly trpcCode = "FORBIDDEN" as const;
}

/**
 * AI guardrails detected a prompt-injection / jailbreak / data-exfil
 * attempt. We surface this as a 403 to the caller but log loudly.
 */
export class AIThreatDetectedError extends AppError {
  readonly code = "AI_THREAT_DETECTED";
  readonly httpStatus = 403;
  readonly trpcCode = "FORBIDDEN" as const;
}

/** Catch-all for "should never happen" branches that nevertheless occur. */
export class InternalError extends AppError {
  readonly code = "INTERNAL";
  readonly httpStatus = 500;
  readonly trpcCode = "INTERNAL_SERVER_ERROR" as const;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Throws DatabaseUnavailableError if `db` is null/undefined; otherwise
 * narrows the type so callers can use `db` without re-checking.
 *
 * Replaces the pattern:
 *
 *     if (!db) throw new Error("Database not available");
 *
 * with:
 *
 *     assertDb(db, "upsertUser");
 *     // db is now non-null below this line
 */
export function assertDb<T>(
  db: T | null | undefined,
  operation?: string
): asserts db is T {
  if (!db) {
    throw new DatabaseUnavailableError(operation);
  }
}

/**
 * Throws NotFoundError if `value` is null/undefined; otherwise narrows
 * the type. Useful in query helpers that should turn "no row" into a 404.
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string,
  context?: Record<string, unknown>
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(`${resource} not found`, { context });
  }
}

/**
 * Map any thrown value to a {@link TRPCError}. AppError subclasses keep
 * their typed code + safe message; everything else becomes a generic
 * INTERNAL_SERVER_ERROR with the original error preserved as `cause` so
 * Sentry still receives the full stack.
 */
export function toTRPCError(err: unknown): TRPCError {
  // Already a TRPCError — pass through unchanged.
  if (err instanceof TRPCError) return err;

  if (isAppError(err)) {
    return new TRPCError({
      code: err.trpcCode,
      message: err.safeMessage,
      cause: err,
    });
  }

  // Anything else: never leak the raw message to the client.
  const cause = err instanceof Error ? err : new Error(String(err));
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    cause,
  });
}

/**
 * tRPC `errorFormatter` shape — strips internal details from the response
 * shipped to the client while keeping enough metadata for the client to
 * render structured errors. Callers should attach this to the tRPC
 * router builder.
 */
export type FormattedTrpcError = {
  message: string;
  code: number;
  data: {
    code: TRPC_ERROR_CODE_KEY;
    httpStatus: number;
    appCode?: AppErrorCode;
    path?: string;
    /** Only included for VALIDATION_FAILED to surface zod issues. */
    zodIssues?: unknown;
  };
};
