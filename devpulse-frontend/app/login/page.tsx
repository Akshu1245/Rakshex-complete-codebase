"use client";
import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleOAuthButton } from "@/components/GoogleOAuthButton";
import { PasswordField } from "@/components/PasswordField";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFAUserId, setTwoFAUserId] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAError, setTwoFAError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const safeRedirect = redirect.startsWith("/") ? redirect : "/dashboard";

  const { data: providers } = trpc.authProviders.list.useQuery();
  const googleEnabled = providers?.google ?? false;

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data?.requires2FA) {
        setRequires2FA(true);
        setTwoFAUserId(String(data.userId || ""));
      } else {
        router.push(safeRedirect);
      }
    },
    onError: (err: { message: string }) => {
      setError(err.message || "Invalid email or password");
    },
  });

  const verify2FA = trpc.auth.verify2FALogin.useMutation({
    onSuccess: () => {
      router.push(safeRedirect);
    },
    onError: (err: { message: string }) => {
      setTwoFAError(err.message || "Invalid verification code");
    },
  });

  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setResetSent(true);
    },
    onError: (err: { message: string }) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ email: email.trim(), password });
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    forgotPassword.mutate({ email: forgotEmail });
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFAError("");
    verify2FA.mutate({ userId: twoFAUserId, code: twoFACode });
  };
  if (requires2FA) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex">
        {/* Left Panel — 2FA Form */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-[400px]">
            <Link
              href="/"
              className="text-sm text-neutral-500 hover:text-neutral-300 flex items-center gap-1 mb-12"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Home
            </Link>
            <div className="mb-8">
              <h1 className="text-[28px] font-semibold text-white mb-1">
                Two-Factor Authentication
              </h1>
              <p className="text-neutral-500 text-sm">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8">
              <form onSubmit={handle2FASubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-[#14B8A6] focus:border-[#14B8A6]/50 text-center font-mono text-xl tracking-[0.5em]"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>
                {twoFAError && <p className="text-red-400 text-sm">{twoFAError}</p>}
                <button
                  type="submit"
                  disabled={verify2FA.isPending || twoFACode.length !== 6}
                  className="w-full py-3 bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-40 text-black font-semibold rounded-lg transition-colors"
                >
                  {verify2FA.isPending ? "Verifying..." : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFACode("");
                    setTwoFAError("");
                    setTwoFAUserId("");
                  }}
                  className="w-full text-neutral-500 hover:text-neutral-300 text-sm py-2"
                >
                  Back to login
                </button>
              </form>
            </div>
          </div>
        </div>
        {/* Right Panel — Wave Dots */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden login-wave-bg">
          <div className="wave-layer" />
          <div className="login-wave-glow" />
          <div className="relative z-10 text-center">
            <h2 className="text-[42px] font-semibold text-white leading-tight">
              Start <span className="text-[#14B8A6]">Securing</span>
            </h2>
          </div>
        </div>
      </div>
    );
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex">
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-[400px]">
            <Link
              href="/"
              className="text-sm text-neutral-500 hover:text-neutral-300 flex items-center gap-1 mb-12"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Home
            </Link>
            <div className="mb-8">
              <h1 className="text-[28px] font-semibold text-white mb-1">Reset your password</h1>
              <p className="text-neutral-500 text-sm">We&apos;ll send you reset instructions</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8">
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 bg-[#14B8A6]/20 rounded-full flex items-center justify-center mx-auto">
                    <svg
                      className="w-6 h-6 text-[#14B8A6]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-white font-medium">Check your email</h3>
                  <p className="text-neutral-500 text-sm">
                    If an account exists, we&apos;ve sent instructions to {forgotEmail}
                  </p>
                  <button
                    onClick={() => {
                      setShowForgot(false);
                      setResetSent(false);
                      setForgotEmail("");
                    }}
                    className="text-[#14B8A6] hover:text-[#0D9488] text-sm font-medium"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide"
                    >
                      Email Address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-[#14B8A6] focus:border-[#14B8A6]/50"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <button
                    type="submit"
                    disabled={forgotPassword.isPending}
                    className="w-full py-3 bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-40 text-black font-semibold rounded-lg transition-colors"
                  >
                    {forgotPassword.isPending ? "Sending..." : "Send Reset Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="w-full text-neutral-500 hover:text-neutral-300 text-sm py-2"
                  >
                    Back to login
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden login-wave-bg">
          <div className="wave-layer" />
          <div className="login-wave-glow" />
          <div className="relative z-10 text-center">
            <h2 className="text-[42px] font-semibold text-white leading-tight">
              Start <span className="text-[#14B8A6]">Securing</span>
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Left Panel — Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-neutral-300 flex items-center gap-1 mb-12"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Home
          </Link>

          <div className="mb-8">
            <h1 className="text-[28px] font-semibold text-white mb-1">Welcome Back</h1>
            <p className="text-neutral-500 text-sm">Login to your account</p>
          </div>

          <div className="space-y-3 mb-6">
            {/* GitHub */}
            <a
              href="/api/oauth/github"
              className="w-full py-2.5 bg-white border border-white/10 rounded-lg font-medium text-sm text-black flex items-center justify-center gap-2 hover:bg-neutral-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23a11.49 11.49 0 0 1 3-.405c1.02 0 2.04.135 3 .405 2.28-1.56 3.285-1.23 3.285-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Continue with GitHub
            </a>
            {/* Google */}
            {googleEnabled && (
              <a
                href="/api/oauth/google"
                className="w-full py-2.5 bg-white border border-white/10 rounded-lg font-medium text-sm text-black flex items-center justify-center gap-2 hover:bg-neutral-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#4285F4"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </a>
            )}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-neutral-600">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-neutral-400 mb-2 uppercase tracking-wide"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-[#14B8A6] focus:border-[#14B8A6]/50 text-sm"
                placeholder="Input your email"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-neutral-400 uppercase tracking-wide"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Forgot Password?
                </button>
              </div>
              <PasswordField
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-[#14B8A6] focus:border-[#14B8A6]/50 text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={login.isPending}
              className="w-full py-3 bg-[#14B8A6] hover:bg-[#0D9488] disabled:opacity-40 text-black font-semibold rounded-lg transition-colors text-sm"
            >
              {login.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-neutral-500 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-white hover:text-[#14B8A6] font-medium transition-colors underline underline-offset-4"
            >
              Sign Up Now
            </Link>
          </p>

          <p className="text-center text-neutral-600 text-xs mt-6">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-neutral-500 hover:text-neutral-400 underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-neutral-500 hover:text-neutral-400 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Right Panel — Wave Dot Grid */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden login-wave-bg">
        <div className="wave-layer" />
        <div className="login-wave-glow" />
        <div className="relative z-10 text-center">
          <h2 className="text-[42px] font-semibold text-white leading-tight">
            Start <span className="text-[#14B8A6]">Securing</span>
          </h2>
        </div>
      </div>
    </div>
  );
}
