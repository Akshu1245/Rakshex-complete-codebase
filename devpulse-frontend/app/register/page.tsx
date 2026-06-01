"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { GoogleOAuthButton } from "@/components/GoogleOAuthButton";
import { PasswordField } from "@/components/PasswordField";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { data: providers } = trpc.authProviders.list.useQuery();
  const googleEnabled = providers?.google ?? false;

  const signup = trpc.auth.signup.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
    },
    onError: (err: { message: string }) => {
      setError(err.message || "Registration failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("REGISTER handleSubmit called, password length:", password.length);
    setError("");
    if (password.length < 8) {
      console.log("Setting error because password length < 8");
      setError("Password must be at least 8 characters");
      return;
    }
    signup.mutate({
      name: name.trim(),
      email: email.trim(),
      password,
    });
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-blue-500">
            RaksHex
          </Link>
          <h2 className="text-gray-400 mt-2">Create your account</h2>
        </div>

        <div className="bg-black/50 p-8 rounded-xl border border-gray-700 space-y-6">
          {/* Google OAuth — only show if configured */}
          {googleEnabled && (
            <>
              <GoogleOAuthButton label="Sign up with Google" />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-black/50 text-gray-400">Or sign up with email</span>
                </div>
              </div>
            </>
          )}

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="signup-form">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Full name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <PasswordField
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={signup.isPending}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
            >
              {signup.isPending ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="text-center text-gray-400 text-sm space-y-2">
            <p>Free plan includes:</p>
            <ul className="text-gray-500 text-xs space-y-1">
              <li>2 Collections & 3 Scans/day</li>
              <li>Up to 5 API endpoints scanned</li>
              <li>100 LLM calls/day via gateway</li>
              <li>1 Team Member</li>
            </ul>
          </div>

          <p className="text-center text-gray-400 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
