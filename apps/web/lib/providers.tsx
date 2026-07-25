"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./trpc";
import { SyncProvider } from "./offline/SyncProvider";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return (
    process.env.NEXT_PUBLIC_TS_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  );
}

/**
 * Read the CSRF token from the cookie set by the backend on login/signup.
 * The cookie name is "csrf-token" and the header name is "x-csrf-token".
 */
export function getCsrfTokenFromCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.split("; ").find((row) => row.startsWith("csrf-token="));
  return match?.split("=")[1];
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const csrfToken = getCsrfTokenFromCookie();
      const headers = new Headers({ "content-type": "application/json" });
      if (csrfToken) headers.set("x-csrf-token", csrfToken);
      const res = await fetch(`${getBaseUrl()}/api/trpc/auth.refreshToken`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      // tRPC mutation may return 200 with error envelope
      const json = (await res.json().catch(() => null)) as {
        error?: { data?: { code?: string }; json?: { data?: { code?: string } } };
        result?: unknown;
      } | null;
      if (!json) return res.ok;
      const code =
        json.error?.data?.code ||
        json.error?.json?.data?.code ||
        (json as { error?: { json?: { data?: { httpStatus?: number } } } }).error?.json?.data
          ?.httpStatus;
      if (code === "UNAUTHORIZED" || code === 401) return false;
      return !json.error;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function isUnauthorizedResponse(res: Response, bodyText: string): boolean {
  if (res.status === 401) return true;
  try {
    const json = JSON.parse(bodyText) as {
      error?: { data?: { code?: string; httpStatus?: number }; message?: string };
      // batch shape: [{ error: ... }]
      [key: number]: { error?: { json?: { data?: { code?: string; httpStatus?: number } } } };
    };
    if (Array.isArray(json)) {
      return json.some(
        (item) =>
          item?.error?.json?.data?.code === "UNAUTHORIZED" ||
          item?.error?.json?.data?.httpStatus === 401,
      );
    }
    return (
      json?.error?.data?.code === "UNAUTHORIZED" ||
      json?.error?.data?.httpStatus === 401 ||
      /UNAUTHORIZED/i.test(json?.error?.message ?? "")
    );
  } catch {
    return false;
  }
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Never retry 4xx errors (client mistakes)
              const trpcError = error as { data?: { httpStatus?: number } } | undefined;
              const status = trpcError?.data?.httpStatus;
              if (typeof status === "number" && status >= 400 && status < 500) {
                return false;
              }
              // Retry up to 3 times for network/server errors with exponential backoff
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
          },
          mutations: {
            retry: 2,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson as any,
          fetch(url, options) {
            const csrfToken = getCsrfTokenFromCookie();
            const headers = new Headers(options?.headers);

            // Attach the CSRF token to all requests that send a body
            // (mutations) so the backend double-submit cookie check passes.
            if (csrfToken && options?.method !== "GET") {
              headers.set("x-csrf-token", csrfToken);
            }

            const urlStr = typeof url === "string" ? url : url.toString();
            const isRefreshCall = urlStr.includes("auth.refreshToken");

            return fetch(url, {
              ...options,
              credentials: "include",
              headers,
            }).then(async (res) => {
              if (isRefreshCall || res.ok) return res;

              // Clone + read so we can detect UNAUTHORIZED without consuming the body
              // for the caller when we are not going to retry.
              const clone = res.clone();
              const bodyText = await clone.text().catch(() => "");
              if (!isUnauthorizedResponse(res, bodyText)) return res;

              const refreshed = await tryRefreshSession();
              if (!refreshed) return res;

              const retryHeaders = new Headers(options?.headers);
              const freshCsrf = getCsrfTokenFromCookie();
              if (freshCsrf && options?.method !== "GET") {
                retryHeaders.set("x-csrf-token", freshCsrf);
              }
              return fetch(url, {
                ...options,
                credentials: "include",
                headers: retryHeaders,
              });
            });
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SyncProvider>{children}</SyncProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
