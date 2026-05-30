"use client";
import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise" | null>(null);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = trpc.auth.me.useQuery(undefined, {
    retry: false,
  });

  const createSubscription = trpc.payment.createSubscription.useMutation({
    onSuccess: (data) => {
      if (data?.shortUrl) {
        window.location.href = data.shortUrl;
      }
    },
    onError: (err) => {
      setError(err.message || "Failed to initiate subscription");
    },
  });

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to join waitlist. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const capitalizedPlan = selectedPlan
      ? selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)
      : "Free";
    joinMutation.mutate({ email, plan: capitalizedPlan, source: "pricing_page" });
  };

  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8 selection:bg-teal-accent selection:text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-6 border-b border-neutral-900">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white font-manrope">
              {me ? "Choose your plan" : "Pricing"}
            </h1>
            <p className="text-neutral-400 mt-2">Choose the plan that fits your needs</p>
          </div>
        </div>

        {createSubscription.error && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono max-w-md">
            {createSubscription.error.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[#141414] p-8 rounded-xl border border-neutral-850 flex flex-col justify-between hover:border-neutral-800 transition-colors">
            <div>
              <h2 className="text-2xl font-bold mb-2">Free</h2>
              <div className="mb-6">
                <p className="text-4xl font-bold text-white">
                  $0<span className="text-lg text-neutral-500 font-normal">/month</span>
                </p>
                <p className="text-xs text-neutral-500 mt-1">₹0/month</p>
              </div>
              <ul className="space-y-3 mb-8 text-neutral-400 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Up to 5 API endpoints scanned
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> 100 LLM calls/day via gateway
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> OWASP Top 10 audit (read-only)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> 2 Collections
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> 3 Scans/day
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Community Support
                </li>
              </ul>
            </div>
            {me ? (
              <span className="block w-full py-3 bg-neutral-800 text-neutral-400 rounded-lg font-medium text-center font-mono mt-auto border border-neutral-700">
                Current Plan
              </span>
            ) : (
              <Link
                href="/register"
                className="block w-full py-3 bg-neutral-800 hover:bg-neutral-750 text-white rounded-lg font-medium transition-colors text-center font-mono mt-auto"
              >
                Get Started
              </Link>
            )}
          </div>

          <div className="bg-[#141414] p-8 rounded-xl border border-teal-accent/50 relative flex flex-col justify-between">
            <div className="absolute top-4 right-4 text-teal-accent text-[10px] font-bold font-mono tracking-wider uppercase bg-teal-accent/10 border border-teal-accent/20 rounded-full px-2 py-0.5">
              POPULAR
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Pro</h2>
              <div className="mb-6">
                <p className="text-4xl font-bold text-white">
                  $99<span className="text-lg text-neutral-500 font-normal">/month</span>
                </p>
                <p className="text-xs text-neutral-500 mt-1">≈ ₹8,299/month</p>
              </div>
              <ul className="space-y-3 mb-8 text-neutral-300 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Up to 10,000 LLM calls/day
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Unlimited Collections + Swagger scans
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Advanced Security Scanning
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Shadow API & Spec-Drift Detection
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Kill Switch & Budget Caps
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> PII Redaction at Gateway
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Token Analytics & Cost Forecasting
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Compliance Reports (OWASP Top 10)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Team Collaboration (5 members)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> 85+ Prompt Injection Payload Library
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-teal-accent">✓</span> Email Support, 1-Business-Day SLA
                </li>
              </ul>
            </div>
            {me ? (
              <button
                onClick={() => createSubscription.mutate({ plan: "pro" })}
                disabled={createSubscription.isPending}
                className="block w-full py-3 bg-teal-accent hover:bg-[#0D9488] disabled:opacity-50 text-white font-bold rounded-lg transition-colors text-center font-mono mt-auto"
              >
                {createSubscription.isPending ? "Processing..." : "Upgrade to Pro"}
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedPlan("pro");
                  setEmail("");
                  setSuccess(false);
                  setError(null);
                }}
                className="block w-full py-3 bg-teal-accent hover:bg-[#0D9488] text-white font-bold rounded-lg transition-colors text-center font-mono mt-auto"
              >
                Join Pro Waitlist
              </button>
            )}
          </div>

          <div className="bg-[#141414] p-8 rounded-xl border border-neutral-850 relative flex flex-col justify-between hover:border-neutral-800 transition-colors">
            <div>
              <h2 className="text-2xl font-bold mb-2">Enterprise</h2>
              <div className="mb-6">
                <p className="text-4xl font-bold text-white">
                  $499<span className="text-lg text-neutral-500 font-normal">/month</span>
                </p>
                <p className="text-xs text-neutral-500 mt-1">≈ ₹41,599/month</p>
              </div>
              <ul className="space-y-3 mb-8 text-neutral-400 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Everything in Pro
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Up to 250,000 LLM calls/day
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Up to 25 Team Members + RBAC Roles
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> MCP Governance: Tool-Call Audit +
                  Permission Graph
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Scheduled AI Red-Team Runs
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> SSO / SAML 2.0 Integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> OWASP / PCI / GDPR / SOC2-Prep
                  Evidence Export
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Slack + Webhook + PagerDuty Alerting
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Priority Support, 4-Hour SLA on P1
                </li>
              </ul>
            </div>
            {me ? (
              <button
                onClick={() => createSubscription.mutate({ plan: "enterprise" })}
                disabled={createSubscription.isPending}
                className="block w-full py-3 bg-neutral-800 hover:bg-neutral-750 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-center font-mono mt-auto"
              >
                {createSubscription.isPending ? "Processing..." : "Upgrade to Enterprise"}
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedPlan("enterprise");
                  setEmail("");
                  setSuccess(false);
                  setError(null);
                }}
                className="block w-full py-3 bg-neutral-800 hover:bg-neutral-750 text-white rounded-lg font-medium transition-colors text-center font-mono mt-auto"
              >
                Join Enterprise Waitlist
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#141414] border border-neutral-800 rounded-xl p-8 max-w-md w-full relative shadow-2xl">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-bold capitalize font-mono text-teal-accent">
                  Join {selectedPlan} Waitlist
                </h3>
                <p className="text-sm text-neutral-400">
                  Enter your email to request access to the {selectedPlan} plan. We&apos;ll notify
                  you as soon as slots open up.
                </p>

                {error && (
                  <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 font-mono">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0F0F0F] border border-neutral-800 rounded-lg focus:outline-none focus:border-teal-accent text-white transition-colors font-mono"
                    disabled={joinMutation.isPending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={joinMutation.isPending}
                  className="w-full py-3 bg-teal-accent hover:bg-[#0D9488] disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 font-mono"
                >
                  {joinMutation.isPending ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="w-12 h-12 bg-emerald-950/20 border border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 text-xl font-bold">
                  ✓
                </div>
                <h3 className="text-xl font-bold font-mono text-emerald-400">
                  You&apos;re on the list!
                </h3>
                <p className="text-sm text-neutral-400">
                  Thank you for your interest. We have registered your email and will be in touch
                  shortly with next steps.
                </p>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="mt-4 px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors font-mono"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
