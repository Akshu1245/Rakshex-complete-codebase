"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/Toast";

export default function CompareTraceableAI() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      addToast("success", "Successfully subscribed to competitor analysis updates!");
    },
    onError: (err) => {
      setError(err.message || "Failed to join waitlist. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    joinMutation.mutate({
      email,
      plan: "Free",
      source: "compare_traceable_ai",
    });
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-3xl mx-auto">
        <nav className="text-sm text-blue-400 mb-6">
          <Link href="/compare" className="hover:underline">
            ← Back to All Comparisons
          </Link>
        </nav>

        <header className="mb-12">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-900/40 uppercase tracking-wider mb-3">
            Comparison Stub
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
            RakshEx vs Traceable AI — Which is Right for You?
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Traceable AI is a leading enterprise API security platform focusing on API discovery,
            threat protection, and posturing. RakshEx operates as a lightweight AI runtime
            governance middleware designed to intercept prompt injections, track thinking token
            costs, and enforce AgentGuard circuit breakers in LLM interactions.
          </p>
        </header>

        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-8 mb-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Full Comparison Coming Soon</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            We are writing an in-depth feature mapping and benchmark suite for RakshEx vs Traceable
            AI. Subscribe below to be notified when the detailed analysis launches.
          </p>

          {success ? (
            <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-sm font-medium max-w-md mx-auto">
              ✓ Successfully subscribed! We will notify you when this page is ready.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={joinMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-2 px-6 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
              >
                Notify Me
              </button>
            </form>
          )}
          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </div>

        <div className="border border-slate-900 rounded-2xl p-6 bg-slate-950/25">
          <h3 className="font-bold text-white mb-4">Core Differentiators Overview</h3>
          <div className="space-y-3 text-sm text-slate-400">
            <p>
              • <strong>LLM Prompt Evaluation:</strong> RakshEx features custom classifier pipelines
              for real-time prompt injection detection. Traceable AI focuses on traditional API
              vulnerabilities (OWASP API Top 10).
            </p>
            <p>
              • <strong>Cost Optimization:</strong> RakshEx attributes thinking tokens and provides
              budget kill switches to control LLM costs. Legacy API security products lack cost
              monitoring.
            </p>
            <p>
              • <strong>Agentic Rules:</strong> RakshEx's AgentGuard blocks destructive tool calls
              based on human approvals, built for modern autonomous agent structures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
