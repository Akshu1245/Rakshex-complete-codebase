"use client";
import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";

// Auth state is sourced from the Node tRPC backend via `auth.me`.
// The session is held in an HttpOnly JWT cookie set by the server's
// `auth.login` / `auth.signup` mutations, so the client no longer
// touches localStorage. This replaces the legacy Python `/auth/login`
// + localStorage.token flow.
//
// Google/GitHub sign-in goes through NextAuth instead, which issues its
// own, separate session cookie that `auth.me` doesn't recognize. Without
// a bridge, a successful social sign-in redirects straight back to
// /login (NextAuth says "authenticated", the app's own session check
// says "no user"). `auth.oauthSync` reads NextAuth's cookie server-side,
// verifies it, and establishes a real app session from it — this effect
// triggers that exchange once per NextAuth session.

interface User {
  id?: number | string;
  email?: string;
  name?: string;
  plan?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: nextAuthSession, status: nextAuthStatus } = useSession();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const logoutMutation = trpc.auth.logout.useMutation();
  const oauthSyncMutation = trpc.auth.oauthSync.useMutation();
  const syncedForSession = useRef<string | null>(null);

  const refresh = useCallback(() => {
    meQuery.refetch();
  }, [meQuery]);

  useEffect(() => {
    if (nextAuthStatus !== "authenticated" || !nextAuthSession) return;
    if (meQuery.isPending || meQuery.data) return;
    const sessionKey = nextAuthSession.user?.email ?? "session";
    if (syncedForSession.current === sessionKey || oauthSyncMutation.isPending) return;
    syncedForSession.current = sessionKey;
    oauthSyncMutation.mutate(undefined, {
      onSuccess: () => meQuery.refetch(),
      onError: () => {
        // Leave syncedForSession set — don't hammer the endpoint on a
        // real failure (e.g. NEXTAUTH_SECRET misconfigured server-side).
      },
    });
    // oauthSyncMutation is intentionally omitted from deps: it's a new
    // object each render, and including it would re-run this on every
    // mutation state change instead of only when the session changes.
  }, [nextAuthStatus, nextAuthSession, meQuery.isPending, meQuery.data]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Logout is best-effort; cookie expiry will eventually invalidate
      // the session even if the request fails.
    }
    meQuery.refetch();
    router.push("/login");
  }, [logoutMutation, meQuery, router]);

  const value: AuthContextType = {
    user: (meQuery.data as User | null | undefined) ?? null,
    // isPending, not isLoading: React Query v5's isLoading is
    // isPending && isFetching. A gap where the query is pending but not
    // fetching looks like "logged out" and AuthGuard unmounts the page
    // (including the Agent Firewall register form) mid-fill.
    loading: meQuery.isPending,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
