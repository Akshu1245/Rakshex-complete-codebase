"use client";

import { useState } from "react";
import { X, Zap, Crown, AlertCircle, Loader2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  requiredPlan?: "pro" | "enterprise";
  requiredFeature?: string;
  currentPlan?: string;
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  image: string;
  handler: () => void;
  prefill: { email?: string; name?: string };
  theme: { color: string };
}

interface RazorpayInstance {
  open(): void;
}

interface RazorpayWindow extends Window {
  Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance;
}

export default function PaywallModal({
  isOpen,
  onClose,
  title = "Upgrade Required",
  description = "This feature requires a paid plan.",
  requiredPlan = "pro",
  requiredFeature,
  currentPlan = "free",
}: PaywallModalProps) {
  const [error, setError] = useState<string | null>(null);

  const plansQuery = trpc.payment.getPlans.useQuery(undefined, {
    enabled: isOpen,
  });
  const plans = plansQuery.data ?? [];

  const createSubscription = trpc.payment.createSubscription.useMutation({
    onSuccess: (subData) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        const win = window as RazorpayWindow;
        if (!win.Razorpay) {
          setError("Razorpay checkout failed to load.");
          return;
        }
        const options: RazorpayOptions = {
          key: subData.keyId,
          subscription_id: subData.subscriptionId,
          name: "Rakshex",
          description: "Subscription",
          image: "/logo.png",
          handler: () => {
            onClose();
            window.location.reload();
          },
          prefill: {},
          theme: { color: "#06D6A0" },
        };
        const rzp = new win.Razorpay(options);
        rzp.open();
      };
      document.body.appendChild(script);
    },
    onError: (err: { message: string }) => setError(err.message || "Failed to create subscription"),
  });

  const handleUpgrade = (planId: string) => {
    if (planId !== "pro" && planId !== "enterprise") return;
    setError(null);
    createSubscription.mutate({ plan: planId });
  };

  const isLoading = createSubscription.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#1E293B] border border-[#2D3E50] rounded-xl p-6 max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#06D6A0]/20 rounded-lg">
              <Zap className="w-5 h-5 text-[#06D6A0]" />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-300 mb-6">{description}</p>

        {requiredFeature && (
          <div className="flex items-center gap-2 p-3 bg-[#FDB022]/10 border border-[#FDB022]/30 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4 text-[#FDB022]" />
            <span className="text-sm text-[#FDB022]">
              Required: {requiredPlan === "enterprise" ? "Enterprise" : "Pro"} plan or higher
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg mb-6 text-[#EF4444] text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Plan Cards */}
        <div className="space-y-3 mb-6">
          {plans.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#06D6A0]" />
            </div>
          ) : (
            plans
              .filter((p) => p.id !== "free")
              .map((plan) => {
                const isRecommended = plan.id === requiredPlan;
                const isCurrent = currentPlan === plan.id;
                const isHigher =
                  (plan.id === "enterprise" && requiredPlan === "pro") ||
                  (plan.id === "pro" && currentPlan === "free");

                return (
                  <div
                    key={plan.id}
                    className={`relative border rounded-lg p-4 transition-all ${
                      isCurrent
                        ? "border-[#10B981]/50 bg-[#10B981]/10"
                        : isRecommended
                          ? "border-[#06D6A0] bg-[#1E293B] ring-1 ring-[#06D6A0]"
                          : "border-[#2D3E50] bg-[#1E293B]/50"
                    }`}
                  >
                    {isRecommended && !isCurrent && (
                      <span className="absolute -top-2 right-4 px-2 py-0.5 bg-[#06D6A0] text-xs font-semibold rounded text-[#0A0E1A]">
                        Recommended
                      </span>
                    )}
                    {isCurrent && (
                      <span className="absolute -top-2 right-4 px-2 py-0.5 bg-[#10B981] text-xs font-semibold rounded flex items-center gap-1 text-[#0A0E1A]">
                        <Check className="w-3 h-3" />
                        Current
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {plan.id === "pro" ? (
                          <Zap className="w-5 h-5 text-[#06D6A0]" />
                        ) : (
                          <Crown className="w-5 h-5 text-[#FDB022]" />
                        )}
                        <div>
                          <h3 className="font-semibold">{plan.name}</h3>
                          <p className="text-sm text-gray-400">
                            {new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: plan.currency,
                            }).format(plan.amount / 100)}
                            /{plan.interval}
                          </p>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="text-sm text-[#10B981]">Active</span>
                      ) : isHigher || plan.id === requiredPlan ? (
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={isLoading}
                          className="px-4 py-2 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] hover:opacity-90 text-[#0A0E1A] text-sm font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upgrade"}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">Lower tier</span>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="mt-3 space-y-1">
                      {plan.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                          <Check className="w-3.5 h-3.5 text-[#10B981] mt-0.5 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#2D3E50]">
          <p className="text-xs text-gray-500">Secure payment via Razorpay. Cancel anytime.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
