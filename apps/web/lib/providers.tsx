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

            return fetch(url, {
              ...options,
              credentials: "include",
              headers,
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
