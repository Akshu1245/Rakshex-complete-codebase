"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WaveDotsCanvas } from "@/components/WaveDotsCanvas";
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
  const [error, setError] = useState<string | null>(
    oauthError ? `Sign-in failed: ${oauthError}` : null,
  );
  const [mfaUserId, setMfaUserId] = useState<number | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.requires2FA && data.userId) {
        setMfaUserId(Number(data.userId));
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
            <h1 className="text-[28px] font-semibold text-white mb-1">Welcome to Rakshex</h1>
            <p className="text-neutral-500 text-sm">Sign in with email or a connected provider</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-md text-sm text-red-300">
              {error}
            </div>
          )}

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
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[#0a0a0a] text-neutral-600">or continue with</span>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <a
              href="/api/oauth/github"
              className="w-full flex items-center justify-center gap-2.5 px-3 py-3 bg-white text-black text-sm rounded-md font-medium hover:opacity-80"
            >
              Continue with GitHub
            </a>
            <a
              href="/api/oauth/google"
              className="w-full flex items-center justify-center gap-2.5 px-3 py-3 bg-neutral-900 border border-neutral-700 text-white text-sm rounded-md font-medium hover:bg-neutral-800"
            >
              Continue with Google
            </a>
          </div>

          <p className="text-center text-neutral-500 text-sm">
            No account?{" "}
            <Link href="/register" className="text-teal-400 hover:text-teal-300">
              Create one
            </Link>
          </p>

          <p className="text-center text-neutral-600 text-xs mt-6">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:flex-1 items-center justify-center relative overflow-hidden login-wave-bg">
        <WaveDotsCanvas />
        <div className="relative z-10 text-center">
          <h2 className="text-[42px] font-semibold text-white leading-tight">
            Secure Your <span className="text-[#14B8A6]">APIs</span>
          </h2>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <LoginForm />
    </Suspense>
  );
}
