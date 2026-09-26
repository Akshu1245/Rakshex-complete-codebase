"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client data layer for the ported dashboard.
 *
 * Every page behind login used to read through the tRPC React client
 * (`${origin}/api/trpc`), which 404s on the Cloudflare Workers deployment.
 * These helpers call the same-origin /api/* proxy routes instead (see
 * app/api/_lib/workers.ts). When a proxy route answers 501 `not_connected`,
 * callers must render <NotConnectedState/> — never mock data.
 */

/** Error code returned by the honest "not connected" proxy routes. */
export const NOT_CONNECTED_CODE = "not_connected";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** True when the Workers deployment has no backend for this resource yet. */
  get notConnected(): boolean {
    return this.status === 501 || this.code === NOT_CONNECTED_CODE;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const obj = (body ?? {}) as { error?: unknown; message?: unknown; code?: unknown };
  const code =
    typeof obj.code === "string" ? obj.code : typeof obj.error === "string" ? obj.error : undefined;
  const rawMessage = typeof obj.message === "string" ? obj.message : obj.error;
  const message =
    typeof rawMessage === "string" && rawMessage.length > 0
      ? rawMessage
      : `Request failed (HTTP ${status})`;
  return new ApiError(status, message, code);
}

/**
 * fetch() against a same-origin /api/* proxy route. Resolves with the parsed
 * JSON body on 2xx; throws ApiError otherwise.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

export interface UseApiResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: ApiError | null;
  notConnected: boolean;
  refetch: () => void;
}

/** GET a proxy route. Pass null / { enabled: false } to skip. */
export function useApi<T>(path: string | null, options?: { enabled?: boolean }): UseApiResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const enabled = (options?.enabled ?? true) && path !== null;

  useEffect(() => {
    if (!enabled || path === null) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiFetch<T>(path).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(0, err instanceof Error ? err.message : String(err)),
        );
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, path, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { data, isLoading, error, notConnected: error !== null && error.notConnected, refetch };
}

export interface UseApiMutationOptions<TRes> {
  onSuccess?: (result: TRes) => void | Promise<void>;
  onError?: (error: ApiError) => void;
}

export interface UseApiMutationResult<TArgs, TRes> {
  mutate: (args: TArgs, options?: UseApiMutationOptions<TRes>) => void;
  mutateAsync: (args: TArgs) => Promise<TRes>;
  isPending: boolean;
  error: ApiError | null;
}

/**
 * POST/PUT/PATCH/DELETE a proxy route. Signature mirrors the old
 * trpc.*.useMutation() so call sites port mechanically.
 */
export function useApiMutation<TArgs = void, TRes = unknown>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
): UseApiMutationResult<TArgs, TRes> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutateAsync = useCallback(
    async (args: TArgs): Promise<TRes> => {
      setIsPending(true);
      setError(null);
      try {
        const result = await apiFetch<TRes>(path, {
          method,
          body: args === undefined ? undefined : JSON.stringify(args),
        });
        setIsPending(false);
        return result;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError(0, err instanceof Error ? err.message : String(err));
        setError(apiError);
        setIsPending(false);
        throw apiError;
      }
    },
    [path, method],
  );

  const mutate = useCallback(
    (args: TArgs, options?: UseApiMutationOptions<TRes>) => {
      mutateAsync(args).then(
        (result) => options?.onSuccess?.(result),
        (err: ApiError) => options?.onError?.(err),
      );
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, error };
}
