"use client";
import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise" | null>(null);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    joinMutation.mutate({ email, source: `pricing_${selectedPlan}` });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400 font-mono">Pricing</h1>
            <p className="text-gray-400 mt-1">
              Choose the plan that fits your needs
            </p>
          </div>
          <Link href="/" className="text-blue-400 hover:text-blue-300 font-mono">
            ← Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Free</h2>
              <div className="mb-6">
                <p className="text-4xl font-bold">
                  $0<span className="text-lg text-gray-400">/month</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">₹0/month</p>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Up to 5 API endpoints scanned
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 100 LLM calls/day via gateway
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> OWASP Top 10 audit (read-only)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 2 Collections
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 3 Scans/day
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Community Support
                </li>
              </ul>
            </div>
            <Link
              href="/register"
              className="block w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-center font-mono mt-auto"
            >
              Get Started
            </Link>
          </div>

          <div className="bg-gray-800 p-8 rounded-lg border border-blue-500 relative flex flex-col justify-between">
            <div className="text-blue-400 text-sm font-semibold mb-2 font-mono">
              POPULAR
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Pro</h2>
              <div className="mb-6">
                <p className="text-4xl font-bold">
                  $99<span className="text-lg text-gray-400">/month</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">≈ ₹8,299/month</p>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Up to 10,000 LLM calls/day
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Unlimited Collections + Postman/OpenAPI scans
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Advanced Security Scanning
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Shadow API & Spec-Drift Detection
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Kill Switch & Budget Caps
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> PII Redaction at Gateway
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Token Analytics & Cost Forecasting
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Compliance Reports (OWASP Top 10)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Team Collaboration (5 members)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> 85+ Prompt Injection Payload Library
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Email Support, 1-Business-Day SLA
                </li>
              </ul>
            </div>
            <button
              onClick={() => {
                setSelectedPlan("pro");
                setEmail("");
                setSuccess(false);
                setError(null);
              }}
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-center font-mono mt-auto"
            >
              Join Pro Waitlist
            </button>
          </div>

          <div className="bg-gray-800 p-8 rounded-lg border border-purple-500 relative flex flex-col justify-between">
            <div className="text-purple-400 text-sm font-semibold mb-2 font-mono">
              ENTERPRISE
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Enterprise</h2>
              <div className="mb-6">
                <p className="text-4xl font-bold">
                  $499<span className="text-lg text-gray-400">/month</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">≈ ₹41,599/month</p>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Everything in Pro
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Up to 250,000 LLM calls/day
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Up to 25 Team Members + RBAC Roles
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> MCP Governance: Tool-Call Audit + Permission Graph
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Scheduled AI Red-Team Runs
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> SSO / SAML 2.0 Integration
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> OWASP / PCI / GDPR / SOC2-Prep Evidence Export
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Slack + Webhook + PagerDuty Alerting
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Priority Support, 4-Hour SLA on P1
                </li>
              </ul>
            </div>
            <button
              onClick={() => {
                setSelectedPlan("enterprise");
                setEmail("");
                setSuccess(false);
                setError(null);
              }}
              className="block w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-center font-mono mt-auto"
            >
              Join Enterprise Waitlist
            </button>
          </div>
        </div>
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-md w-full relative shadow-2xl">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-bold capitalize font-mono text-blue-400">
                  Join {selectedPlan} Waitlist
                </h3>
                <p className="text-sm text-gray-400">
                  Enter your email to request access to the {selectedPlan} plan. We&apos;ll notify you as soon as slots open up.
                </p>

                {error && (
                  <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 font-mono">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white transition-colors font-mono"
                    disabled={joinMutation.isPending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={joinMutation.isPending}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 font-mono"
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
                <div className="w-12 h-12 bg-green-900/30 border border-green-500 rounded-full flex items-center justify-center mx-auto text-green-400 text-xl">
                  ✓
                </div>
                <h3 className="text-xl font-bold font-mono text-green-400">You&apos;re on the list!</h3>
                <p className="text-sm text-gray-400">
                  Thank you for your interest. We have registered your email and will be in touch shortly with next steps.
                </p>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors font-mono"
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

