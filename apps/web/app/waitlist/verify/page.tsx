"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function WaitlistVerifyPage() {
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  const verify = trpc.waitlist.verify.useMutation();
  const result = verify.data;

  const copyReferral = async () => {
    if (!result?.referralUrl) return;
    await navigator.clipboard.writeText(result.referralUrl);
    setCopied(true);
  };

  return (
    <main className="min-h-screen bg-transparent px-5 pb-20 pt-[140px] text-white sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.09] bg-[#090D14]/85 p-7 sm:p-10">
        {!result ? (
          <>
            <ShieldCheck className="h-11 w-11 text-[#14B8A6]" />
            <p className="mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#14B8A6]">Scanner-safe verification</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">Confirm that this beta request is yours.</h1>
            <p className="mt-4 text-sm leading-6 text-neutral-400">Opening this page did not verify anything. That is intentional: corporate email scanners and browser prefetchers often open links automatically. Press the button below to perform the one-time confirmation.</p>
            <button
              type="button"
              disabled={!token || verify.isPending}
              onClick={() => verify.mutate({ token })}
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#14B8A6] px-5 text-sm font-semibold text-white hover:bg-[#0D9488] disabled:opacity-50"
            >
              {verify.isPending ? "Confirming…" : "Confirm my spot"}
            </button>
            {!token && <p className="mt-4 text-sm text-red-300">The verification token is missing from this link.</p>}
            {verify.isError && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3 text-sm text-red-300">{verify.error.message}</p>}
          </>
        ) : (
          <>
            <CheckCircle2 className="h-11 w-11 text-[#14B8A6]" />
            <p className="mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#14B8A6]">Verified</p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">Your RaksHex beta request is confirmed.</h1>
            <p className="mt-4 text-sm leading-6 text-neutral-400">Current verified queue position: <strong className="text-white">#{result.position}</strong>. Production fit and design-partner intent can be prioritized independently of queue position.</p>
            <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Relevant referral link</p>
              <p className="mt-2 break-all text-sm text-[#8FE3D8]">{result.referralUrl}</p>
              <button type="button" onClick={copyReferral} className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-[#14B8A6]/40"><Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy link"}</button>
              <p className="mt-3 text-xs leading-5 text-neutral-600">Only verified referrals count. Please share this with people who actually build or operate AI/agent systems.</p>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#14B8A6] px-4 text-sm font-semibold text-white no-underline hover:bg-[#0D9488]">Explore public demo</Link>
              <Link href="/docs" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-white no-underline">Read docs</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
