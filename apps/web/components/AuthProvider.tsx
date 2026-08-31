"use client";
import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";

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

function ensureCsrfCookie(): void {
  if (typeof document === "undefined") return;
  const existing = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf-token="))
    ?.split("=")[1];
  if (existing) return;

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `csrf-token=${token}; Path=/; SameSite=Lax${secure}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: nextAuthSession, status: nextAuthStatus } = useSession();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const logoutMutation = trpc.auth.logout.useMutation();
  const syncedForSession = useRef<string | null>(null);
  const syncInFlight = useRef(false);

  const refresh = useCallback(() => {
    meQuery.refetch();
  }, [meQuery]);

  useEffect(() => {
    if (nextAuthStatus !== "authenticated" || !nextAuthSession) return;
    if (meQuery.isPending || meQuery.data) return;

    const sessionKey = nextAuthSession.user?.email ?? "session";
    if (syncedForSession.current === sessionKey || syncInFlight.current) return;

    ensureCsrfCookie();
    syncedForSession.current = sessionKey;
    syncInFlight.current = true;

    void fetch("/api/auth/bridge", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Social session bridge failed (${response.status})`);
        }
        await meQuery.refetch();
      })
      .catch(() => {
        // Permit one retry on a later render/network recovery instead of
        // leaving the authenticated NextAuth user permanently stuck.
        syncedForSession.current = null;
      })
      .finally(() => {
        syncInFlight.current = false;
      });
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
    loading: !meQuery.data && (meQuery.isPending || meQuery.isFetching || syncInFlight.current),
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
