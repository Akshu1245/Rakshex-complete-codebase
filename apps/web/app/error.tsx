"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[calc(100svh-94px)] items-center justify-center px-5 py-16 sm:px-6">
      <div className="w-full max-w-xl rounded-2xl border border-red-500/20 bg-[#090D14]/80 p-7 text-left shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-10">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.08] text-red-400">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-red-400">
          Request failed safely
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
          RaksHex could not finish this page.
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-400">
          Retry the request. If the problem continues, use the public status page or contact the
          team. Internal exception details are intentionally not exposed here.
        </p>
        {error.digest && (
          <p className="mt-4 rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 font-mono text-[11px] text-neutral-500">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-4 text-sm font-semibold text-white hover:bg-[#0D9488]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
          <Link
            href="/status"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/40"
          >
            Service status
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/40"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
