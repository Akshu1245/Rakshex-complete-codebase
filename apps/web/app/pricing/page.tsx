"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

type PaidPlan = "pro" | "enterprise";

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan | null>(null);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false });
  const { data: plans, isLoading } = trpc.payment.getPlans.useQuery();

  const createSubscription = trpc.payment.createSubscription.useMutation({
    onSuccess: (data) => {
      if (data?.shortUrl) window.location.href = data.shortUrl;
    },
    onError: (err) => setError(err.message || "Failed to initiate subscription"),
  });

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError(null);
    },
    onError: (err) => setError(err.message || "Failed to join waitlist. Please try again."),
  });

  const byId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof plans>[number]>();
    for (const p of plans ?? []) map.set(p.id, p);
    return map;
  }, [plans]);

  const free = byId.get("free");
  const pro = byId.get("pro");
  const enterprise = byId.get("enterprise");

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
            <p className="text-neutral-400 mt-2">
              Plans come from the server billing catalog — the same source checkout uses.
            </p>
          </div>
        </div>

        {(createSubscription.error || error) && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-mono max-w-md">
            {createSubscription.error?.message || error}
          </div>
        )}

        {isLoading ? (
          <p className="text-neutral-500 font-mono text-sm">Loading plans…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PlanCard
              name={free?.name ?? "Free"}
              usdCents={free?.usdAmount ?? 0}
              inrPaise={free?.amount ?? 0}
              features={free?.features ?? []}
              footer={
                me ? (
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
                )
              }
            />

            <PlanCard
              name={pro?.name ?? "Pro"}
              usdCents={pro?.usdAmount ?? 9900}
              inrPaise={pro?.amount ?? 829900}
              popular
              features={pro?.features ?? []}
              footer={
                me ? (
                  <button
                    onClick={() => createSubscription.mutate({ plan: "pro" })}
                    disabled={createSubscription.isPending}
                    className="block w-full py-3 bg-teal-accent hover:bg-[#0D9488] disabled:opacity-50 text-white font-bold rounded-lg transition-colors text-center font-mono mt-auto"
                  >
                    {createSubscription.isPending ? "Processing..." : "Upgrade to Pro"}
                  </button>
                ) : (
                  <Link
                    href="/login?redirect=/pricing"
                    className="block w-full py-3 bg-teal-accent hover:bg-[#0D9488] text-white font-bold rounded-lg transition-colors text-center font-mono mt-auto"
                  >
                    Sign up to upgrade
                  </Link>
                )
              }
            />

            <PlanCard
              name={enterprise?.name ?? "Enterprise"}
              usdCents={enterprise?.usdAmount ?? 49900}
              inrPaise={enterprise?.amount ?? 4159900}
              features={enterprise?.features ?? []}
              footer={
                me ? (
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
                )
              }
            />
          </div>
        )}
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
                  Join {selectedPlan} Waitlist
                </h3>
                <p className="text-sm text-neutral-400">
                  Enter your email to request access to the {selectedPlan} plan.
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
                  {joinMutation.isPending ? "Submitting…" : "Submit Request"}
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
  name: string;
  usdCents: number;
  inrPaise: number;
  features: readonly string[];
  popular?: boolean;
  footer: React.ReactNode;
}) {
  const usd = (props.usdCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const inr = (props.inrPaise / 100).toLocaleString("en-IN");
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
        <h2 className="text-2xl font-bold mb-2">{props.name}</h2>
        <div className="mb-6">
          <p className="text-4xl font-bold text-white">
            ${usd}
            <span className="text-lg text-neutral-500 font-normal">/month</span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">≈ ₹{inr}/month</p>
        </div>
        <ul className="space-y-3 mb-8 text-neutral-400 text-sm">
          {props.features.map((f) => (
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
