import Link from "next/link";
import { ArrowRight, FileQuestion, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100svh-94px)] items-center justify-center px-5 py-16 sm:px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#090D14]/75 p-7 text-left shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-10">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#14B8A6]/25 bg-[#14B8A6]/[0.07] text-[#14B8A6]">
          <FileQuestion className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#14B8A6]">
          404 · Route not found
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
          This path is not part of the current RaksHex surface.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-400 sm:text-base">
          Use a verified public route below. Private-beta product areas may require sign-in or a
          scoped evaluation invite.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/overview"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-4 text-sm font-semibold text-white no-underline hover:bg-[#0D9488]"
          >
            View product <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/40"
          >
            Read docs
          </Link>
          <Link
            href="/waitlist"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/40"
          >
            <ShieldCheck className="h-4 w-4 text-[#14B8A6]" aria-hidden="true" /> Request beta access
          </Link>
        </div>
      </div>
    </main>
  );
}
