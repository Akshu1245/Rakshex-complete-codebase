"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

function MfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = trpc.auth.verify2FALogin.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">Missing MFA session. Please sign in again.</p>
          <Link href="/login" className="text-teal-400">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-black/50 border border-neutral-800 rounded-lg p-8">
        <h1 className="text-2xl font-semibold mb-2">Two-factor authentication</h1>
        <p className="text-neutral-500 text-sm mb-6">
          {useRecovery
            ? "Enter one of your single-use recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-md text-sm text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            verify.mutate({
              userId,
              code: code.trim(),
              useRecoveryCode: useRecovery,
            });
          }}
          className="space-y-4"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={useRecovery ? "XXXXX-XXXXX" : "000000"}
            autoComplete="one-time-code"
            className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-md text-sm tracking-widest text-center"
            required
          />
          <button
            type="submit"
            disabled={verify.isPending}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {verify.isPending ? "Verifying…" : "Verify"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setUseRecovery(!useRecovery);
            setCode("");
            setError(null);
          }}
          className="w-full mt-4 text-sm text-neutral-400 hover:text-neutral-200"
        >
          {useRecovery ? "Use authenticator code instead" : "Use a recovery code"}
        </button>

        <Link href="/login" className="block text-center text-sm text-neutral-500 mt-6">
          Cancel
        </Link>
      </div>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <MfaForm />
    </Suspense>
  );
}
