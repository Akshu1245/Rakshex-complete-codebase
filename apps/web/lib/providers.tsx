"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { SessionProvider } from "next-auth/react";
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

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
  );

  // The tRPC client + provider remain because two forbidden auth/demo files
  // (app/login/page.tsx, app/demo/judge/page.tsx) still call trpc hooks at
  // render time — removing the provider makes static export throw
  // "Unable to find tRPC Context". Every allowed consumer has been ported to
  // /api routes via useApi/useApiMutation; no client call reaches the
  // network on this deployment.
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson as never,
        }),
      ],
    }),
  );

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SyncProvider>{children}</SyncProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
