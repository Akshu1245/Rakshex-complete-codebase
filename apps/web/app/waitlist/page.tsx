"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

const EVALUATION_OPTIONS = [
  { value: "Free", label: "Developer", detail: "Evaluate a personal or local agent workflow" },
  { value: "Pro", label: "Team pilot", detail: "Evaluate with an engineering or platform team" },
  { value: "Enterprise", label: "Security review", detail: "Architecture, policy, or enterprise evaluation" },
] as const;

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<(typeof EVALUATION_OPTIONS)[number]["value"]>("Pro");
  const [submitted, setSubmitted] = useState(false);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    joinWaitlist.mutate({ email: email.trim(), plan });
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-transparent px-5 pb-20 pt-[126px] text-white sm:px-6 xl:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div className="pt-4 lg:sticky lg:top-[126px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/[0.07] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8FE3D8]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Private beta
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.04em] text-white sm:text-5xl">
              Request a scoped RaksHex evaluation.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-400">
              Start with one agent and one consequential action. We use the request to understand
              whether the current beta is a fit before asking you to connect production accounts.
            </p>

            <div className="mt-8 space-y-4 border-t border-white/[0.08] pt-6">
              {[
                "No invented customer or certification claims",
                "No requirement to connect production credentials just to request access",
                "A pilot can begin with a simulated or non-production workflow",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm leading-6 text-neutral-400">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#14B8A6]" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <Link href="/demo" className="font-semibold text-[#14B8A6] no-underline hover:text-[#5ED8CA]">
                Try the public demo →
              </Link>
              <Link href="/trust" className="font-semibold text-neutral-400 no-underline hover:text-white">
                Review Trust Center →
              </Link>
            </div>
          </div>

          {!submitted ? (
            <div className="rounded-2xl border border-white/[0.09] bg-[#090D14]/75 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-8">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  Beta request
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-white">
                  Tell us how you want to evaluate RaksHex.
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-6">
                <div>
                  <label htmlFor="beta-email" className="block text-sm font-semibold text-neutral-300">
                    Work email
                  </label>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    Used for beta access and evaluation follow-up only.
                  </p>
                  <input
                    id="beta-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="you@company.com"
                    className="mt-3 min-h-12 w-full rounded-lg border border-white/10 bg-black/25 px-4 text-base text-white placeholder:text-neutral-700 focus:border-[#14B8A6]/60 focus:outline-none"
                  />
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-neutral-300">Evaluation type</legend>
                  <div className="mt-3 space-y-2">
                    {EVALUATION_OPTIONS.map((option) => {
                      const active = plan === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPlan(option.value)}
                          aria-pressed={active}
                          className={`w-full rounded-xl border p-4 text-left ${
                            active
                              ? "border-[#14B8A6]/45 bg-[#14B8A6]/[0.06]"
                              : "border-white/[0.08] bg-black/15 hover:border-white/15"
                          }`}
                        >
                          <span className={`block text-sm font-semibold ${active ? "text-[#8FE3D8]" : "text-white"}`}>
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-neutral-500">{option.detail}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={joinWaitlist.isPending}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-5 text-sm font-semibold text-white hover:bg-[#0D9488] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {joinWaitlist.isPending ? (
                    "Sending request…"
                  ) : (
                    <>
                      Request beta access <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>

                {joinWaitlist.isError && (
                  <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
                    We could not submit the request. Please try again, or email akshay@rakshex.in.
                  </div>
                )}
              </form>

              <p className="mt-5 text-xs leading-5 text-neutral-600">
                By requesting access, you agree that RaksHex may contact you about the private beta.
                See the <Link href="/privacy" className="text-neutral-400 underline underline-offset-2">Privacy Policy</Link>.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#14B8A6]/25 bg-[#0B1414] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-9" aria-live="polite">
              <CheckCircle2 className="h-11 w-11 text-[#14B8A6]" aria-hidden="true" />
              <p className="mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#14B8A6]">
                Request received
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-white">You are in the beta queue.</h2>
              <p className="mt-4 text-sm leading-6 text-neutral-400">
                We will use <strong className="font-semibold text-white">{email}</strong> to follow
                up about a scoped evaluation. You do not need to connect production credentials now.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#14B8A6] px-4 text-sm font-semibold text-white no-underline hover:bg-[#0D9488]"
                >
                  Explore the public demo
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-4 text-sm font-semibold text-white no-underline hover:border-[#14B8A6]/40"
                >
                  Read documentation
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
