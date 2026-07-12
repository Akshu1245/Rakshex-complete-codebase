"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const forgot = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => setDone(true),
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-black/50 border border-neutral-800 rounded-lg p-8">
        <h1 className="text-2xl font-semibold mb-2">Reset password</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Enter your email and we&apos;ll send a single-use link that expires in one hour.
        </p>

        {done ? (
          <div className="p-4 bg-teal-900/20 border border-teal-700/40 rounded-md text-sm text-teal-200">
            If an account exists for that email, a reset link has been sent.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              forgot.mutate({ email: email.trim() });
            }}
            className="space-y-4"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-md text-sm"
            />
            {forgot.error && <p className="text-sm text-red-400">{forgot.error.message}</p>}
            <button
              type="submit"
              disabled={forgot.isPending}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {forgot.isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="block text-center text-sm text-neutral-500 mt-6 hover:text-neutral-300"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
