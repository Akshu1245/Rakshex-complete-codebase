"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AgentFirewallCanvas } from "@/components/AgentFirewallCanvas";
import { trpc } from "@/lib/trpc";
import { PasswordField } from "@/components/PasswordField";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(
    oauthError && oauthError !== "OAuthAccountNotLinked"
      ? oauthError === "OAuthSignin" || oauthError === "OAuthCallback"
        ? "OAuth sign-in failed. Please check your credentials and try again."
        : `Sign-in failed. Please try again.`
      : oauthError === "OAuthAccountNotLinked"
        ? "This email is already registered. Please sign in with your email/password."
        : null,
  );

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.requires2FA && data.userId) {
        router.push(`/mfa?userId=${data.userId}`);
        return;
      }
      router.push(redirect);
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate({ email: email.trim(), password });
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setError(`Failed to sign in with ${provider}. Please try again.`);
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <div className="w-full lg:w-[480px] flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-neutral-300 flex items-center gap-1 mb-12"
          >
            ← Home
          </Link>

          <div className="mb-8">
            <h1 className="text-[28px] font-semibold text-white mb-1">Welcome to RaksHex</h1>
            <p className="text-neutral-500 text-sm">
              Sign in to your account or continue with a provider
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-md text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Social Login Buttons (Google & GitHub) */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuth("google")}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 text-white text-sm rounded-lg font-medium transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {oauthLoading === "google" ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}</span>
            </button>

            <button
              onClick={() => handleOAuth("github")}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-neutral-100 text-black text-sm rounded-lg font-semibold transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {oauthLoading === "github" ? (
                <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              )}
              <span>{oauthLoading === "github" ? "Redirecting…" : "Continue with GitHub"}</span>
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#0a0a0a] text-neutral-500 uppercase font-mono">
                or sign in with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 mb-6">
            <div>
              <label htmlFor="email" className="block text-xs text-neutral-400 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-md text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs text-neutral-400 mb-1">
                Password
              </label>
              <PasswordField
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-teal-400 hover:text-teal-300">
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={login.isPending}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-md disabled:opacity-50 transition-all"
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-neutral-500 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-teal-400 hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 relative bg-neutral-950 border-l border-neutral-900 overflow-hidden">
        <AgentFirewallCanvas />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 px-10 pb-12">
          <p className="text-2xl font-bold leading-snug tracking-[-0.02em] text-white max-w-sm">
            Competitors govern the session.
            <br />
            <span className="text-[#14B8A6]">RaksHex governs the action.</span>
          </p>
          <p className="mt-3 text-sm text-neutral-500 max-w-sm">
            Every action evaluated against delegated authority. A DENY blocks the credential itself.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
