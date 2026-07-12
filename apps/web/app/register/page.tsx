"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { PasswordField } from "@/components/PasswordField";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signup = trpc.auth.signup.useMutation({
    onSuccess: () => {
      router.push("/verify-email?pending=1");
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    signup.mutate({ name: name.trim(), email: email.trim(), password });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-[400px]">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300 mb-8 inline-block"
        >
          ← Home
        </Link>
        <h1 className="text-2xl font-semibold mb-1">Create your account</h1>
        <p className="text-neutral-500 text-sm mb-6">Email and password, secured with Argon2id</p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-md text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1" htmlFor="password">
              Password
            </label>
            <PasswordField
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={signup.isPending}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {signup.isPending ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 border-t border-neutral-800" />
          <span className="text-xs text-neutral-600">or</span>
          <div className="flex-1 border-t border-neutral-800" />
        </div>

        <div className="space-y-2">
          <a
            href="/api/oauth/github"
            className="block w-full text-center py-2.5 bg-white text-black text-sm rounded-md font-medium"
          >
            Sign up with GitHub
          </a>
          <a
            href="/api/oauth/google"
            className="block w-full text-center py-2.5 border border-neutral-700 text-sm rounded-md"
          >
            Sign up with Google
          </a>
        </div>

        <p className="text-center text-neutral-500 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-teal-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
