"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle, Zap } from "lucide-react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("Free");
  const [submitted, setSubmitted] = useState(false);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    joinWaitlist.mutate({ email: email.trim(), plan: plan as "Free" | "Pro" | "Enterprise" });
  };

  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8">
      <div className="max-w-3xl mx-auto text-center">
        {/* Hero */}
        <div className="mb-12">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/20 text-[#14B8A6] text-sm font-medium mb-6">
            <Zap className="w-4 h-4" /> Early Access
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 font-manrope">Join the Waitlist</h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto leading-relaxed">
            Be the first to get access to new features, beta programs, and exclusive early-bird
            pricing.
          </p>
        </div>

        {/* Form */}
        {!submitted ? (
          <div className="bg-black/50 rounded-2xl border border-neutral-800 p-8 max-w-lg mx-auto">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-neutral-400 mb-2 text-left">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full bg-black/50 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-[#14B8A6]/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2 text-left">
                  Interested plan
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["Free", "Pro", "Enterprise"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlan(p)}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                        plan === p
                          ? "bg-[#14B8A6]/10 border-[#14B8A6]/40 text-[#14B8A6]"
                          : "bg-black/50 border-neutral-700 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={joinWaitlist.isPending}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#14B8A6] to-[#2dd4bf] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {joinWaitlist.isPending ? (
                  "Joining..."
                ) : (
                  <>
                    Join Waitlist <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {joinWaitlist.isError && (
                <p className="text-red-400 text-sm">{joinWaitlist.error.message}</p>
              )}
            </form>
            <p className="text-neutral-500 text-xs mt-4">
              No spam. Unsubscribe anytime. We respect your privacy.
            </p>
          </div>
        ) : (
          <div className="bg-black/50 rounded-2xl border border-[#14B8A6]/20 p-8 max-w-lg mx-auto">
            <CheckCircle className="w-12 h-12 text-[#14B8A6] mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">You are on the list!</h2>
            <p className="text-neutral-400 mb-6">
              We will reach out to <strong className="text-white">{email}</strong> when your early
              access is ready.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/20 text-[#14B8A6] text-sm font-medium hover:bg-[#14B8A6]/20 transition-colors"
            >
              Back to home <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mt-12">
          {[
            { label: "Beta Users", value: "500+" },
            { label: "Companies", value: "120+" },
            { label: "Countries", value: "25+" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-neutral-500 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
