"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApiMutation } from "@/lib/api";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const pending = searchParams.get("pending");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  // Email verification has no /v1 equivalent on the Workers deployment —
  // /api/auth answers 501 not_connected, and the result renders honestly.
  const verify = useApiMutation<{ token: string }, unknown>("/api/auth", "POST");
  const request = useApiMutation<Record<string, never>, { devToken?: string }>("/api/auth", "POST");
  const [devToken, setDevToken] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      verify.mutate(
        { token },
        {
          onSuccess: () => {
            setStatus("ok");
            setMessage("Email verified successfully.");
          },
          onError: (err) => {
            setStatus("err");
            setMessage(err.message);
          },
        },
      );
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-black/50 border border-neutral-800 rounded-lg p-8 text-center">
        <h1 className="text-2xl font-semibold mb-2">Email verification</h1>

        {pending && !token && (
          <>
            <p className="text-neutral-400 text-sm mb-4">
              Account created. Check your inbox for a verification link, or resend below.
            </p>
            <button
              type="button"
              onClick={() =>
                request.mutate(
                  {},
                  {
                    onSuccess: (result) =>
                      setDevToken(result && "devToken" in result ? String(result.devToken) : null),
                  },
                )
              }
              className="px-4 py-2 bg-teal-600 rounded-md text-sm"
            >
              {request.isPending ? "Sending…" : "Resend verification"}
            </button>
            {devToken && (
              <p className="mt-3 text-xs text-neutral-500 break-all">Dev token: {devToken}</p>
            )}
          </>
        )}

        {token && status === "idle" && <p className="text-neutral-400 text-sm">Verifying…</p>}
        {status === "ok" && <p className="text-teal-300 text-sm">{message}</p>}
        {status === "err" && <p className="text-red-400 text-sm">{message}</p>}

        <Link href="/login" className="block mt-6 text-sm text-teal-400">
          Continue to login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
