"use client";
import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { parseGetPlansPayload, type CatalogPlan } from "@/lib/billingCatalog";

export function PricingView({ initialPlans }: { initialPlans: readonly CatalogPlan[] }) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plansQuery = trpc.payment.getPlans.useQuery(undefined, {
    retry: false,
    placeholderData: initialPlans,
  });
  const livePlans = parseGetPlansPayload(plansQuery.data) ?? plansQuery.data;
  const plans: readonly CatalogPlan[] =
    Array.isArray(livePlans) && livePlans.length > 0
      ? (livePlans as CatalogPlan[])
      : initialPlans;

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError(null);
    },
    onError: (err: { message?: string }) =>
      setError(err.message || "Failed to join waitlist. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !selectedPlan) return;
    const capitalizedPlan = selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1);
    joinMutation.mutate({ email, plan: capitalizedPlan, source: "pricing_page" });
  };

  const openWaitlist = (planId: string) => {
    setSelectedPlan(planId);
    setEmail("");
    setSuccess(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8 selection:bg-teal-accent selection:text-black">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-6 border-b border-neutral-900">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white font-manrope">
              Evaluation pricing
            </h1>
            <p className="text-neutral-400 mt-2 max-w-2xl">
              Private-beta list prices from the billing catalog. Self-serve checkout is not open.
              Join the waitlist, or{" "}
              <Link href="/login" className="text-teal-accent hover:underline">
                sign in with an invite
              </Link>
              .
            </p>
          </div>
        </div>

        {error && !selectedPlan && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono max-w-md">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              popular={plan.id === "pro"}
              footer={
                <button
                  type="button"
                  onClick={() => openWaitlist(plan.id)}
                  className={`block w-full py-3 rounded-lg font-medium transition-colors text-center font-mono mt-auto ${
                    plan.id === "pro"
                      ? "bg-teal-accent hover:bg-[#0D9488] text-white font-bold"
                      : "bg-neutral-800 hover:bg-neutral-750 text-white"
                  }`}
                >
                  Join waitlist
                </button>
              }
            />
          ))}
        </div>
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-transparent border border-neutral-800 rounded-xl p-8 max-w-md w-full relative shadow-2xl">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>
            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-bold capitalize font-mono text-teal-accent">
                  Join {selectedPlan} waitlist
                </h3>
                <p className="text-sm text-neutral-400">
                  Enter your email to request a scoped evaluation for the {selectedPlan} plan.
                </p>
                {error && (
                  <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono">
                    {error}
                  </div>
                )}
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-transparent border border-neutral-800 rounded-lg focus:outline-none focus:border-teal-accent text-white transition-colors font-mono"
                  disabled={joinMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={joinMutation.isPending}
                  className="w-full py-3 bg-teal-accent hover:bg-[#0D9488] disabled:opacity-50 text-white font-bold rounded-lg transition-colors font-mono"
                >
                  {joinMutation.isPending ? "Submitting…" : "Submit request"}
                </button>
              </form>
            ) : (
              <div className="text-center space-y-4 py-4">
                <h3 className="text-xl font-bold font-mono text-emerald-400">
                  You&apos;re on the list!
                </h3>
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

function PlanCard(props: {
  plan: CatalogPlan;
  popular?: boolean;
  footer: React.ReactNode;
}) {
  const usd = (props.plan.usdAmount / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const inr = (props.plan.amount / 100).toLocaleString("en-IN");
  return (
    <div
      className={`bg-transparent p-8 rounded-xl border relative flex flex-col justify-between ${
        props.popular
          ? "border-teal-accent/50"
          : "border-neutral-850 hover:border-neutral-800 transition-colors"
      }`}
    >
      {props.popular && (
        <div className="absolute top-4 right-4 text-teal-accent text-[10px] font-bold font-mono tracking-wider uppercase bg-teal-accent/10 border border-teal-accent/20 rounded-full px-2 py-0.5">
          POPULAR
        </div>
      )}
      <div>
        <h2 className="text-2xl font-bold mb-2">{props.plan.name}</h2>
        <div className="mb-6">
          <p className="text-4xl font-bold text-white">
            ${usd}
            <span className="text-lg text-neutral-500 font-normal">/month</span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">≈ ₹{inr}/month</p>
        </div>
        <ul className="space-y-3 mb-8 text-neutral-400 text-sm">
          {props.plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className={props.popular ? "text-teal-accent" : "text-emerald-400"}>✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {props.footer}
    </div>
  );
}
