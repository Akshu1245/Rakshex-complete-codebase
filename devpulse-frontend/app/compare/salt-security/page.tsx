"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/Toast";

export default function CompareSaltSecurity() {
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
      source: "compare_salt_security",
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 font-sans">
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
            RakshEx vs Salt Security — Which is Right for You?
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Salt Security is a pioneer in API anomaly detection, focusing on posture management and threat protection using machine learning baselines. RakshEx is a targeted AI runtime governance firewall, designed to prevent prompt injections, track LLM token spend, and regulate agentic tool calls before they run.
          </p>
        </header>

        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-8 mb-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Full Comparison Coming Soon</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            We are writing an in-depth feature mapping and benchmark suite for RakshEx vs Salt Security. Subscribe below to be notified when the detailed analysis launches.
          </p>

          {success ? (
            <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-sm font-medium max-w-md mx-auto">
              ✓ Successfully subscribed! We will notify you when this page is ready.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
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
              • <strong>Prompt Firewalling:</strong> RakshEx dynamically inspects incoming prompts for adversarial structures. Salt Security is built to analyze traditional API payloads and does not evaluate prompt semantics.
            </p>
            <p>
              • <strong>Thinking Token telemetry:</strong> RakshEx extracts reasoning metadata and allocates LLM usage spend. Legacy API protection tools have no concept of token counts or model pricing.
            </p>
            <p>
              • <strong>Interactive Approvals:</strong> RakshEx’s AgentGuard provides a human-in-the-loop validation console for security critical agent tool executions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
