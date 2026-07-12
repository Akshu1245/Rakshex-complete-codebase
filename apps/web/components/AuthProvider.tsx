"use client";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

// Auth state is sourced from the Node tRPC backend via `auth.me`.
// The session is held in an HttpOnly JWT cookie set by the server's
// `auth.login` / `auth.signup` mutations, so the client no longer
// touches localStorage. This replaces the legacy Python `/auth/login`
// + localStorage.token flow.

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
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const logoutMutation = trpc.auth.logout.useMutation();

  const refresh = useCallback(() => {
    meQuery.refetch();
  }, [meQuery]);

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
    loading: meQuery.isLoading,
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
