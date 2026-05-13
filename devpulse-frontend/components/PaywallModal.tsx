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
    onSuccess: subData => {
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
          name: "DevPulse",
          description: "Subscription",
          image: "/logo.png",
          handler: () => {
            onClose();
            window.location.reload();
          },
          prefill: {},
          theme: { color: "#6366f1" },
        };
        const rzp = new win.Razorpay(options);
        rzp.open();
      };
      document.body.appendChild(script);
    },
    onError: (err: { message: string }) =>
      setError(err.message || "Failed to create subscription"),
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-lg">
              <Zap className="w-5 h-5 text-indigo-400" />
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
          <div className="flex items-center gap-2 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300">
              Required: {requiredPlan === "enterprise" ? "Enterprise" : "Pro"}{" "}
              plan or higher
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg mb-6 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Plan Cards */}
        <div className="space-y-3 mb-6">
          {plans.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            plans
              .filter(p => p.id !== "free")
              .map(plan => {
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
                        ? "border-green-500/50 bg-green-900/10"
                        : isRecommended
                          ? "border-indigo-500 bg-indigo-900/20 ring-1 ring-indigo-500"
                          : "border-gray-800 bg-gray-900/50"
                    }`}
                  >
                    {isRecommended && !isCurrent && (
                      <span className="absolute -top-2 right-4 px-2 py-0.5 bg-indigo-600 text-xs font-medium rounded">
                        Recommended
                      </span>
                    )}
                    {isCurrent && (
                      <span className="absolute -top-2 right-4 px-2 py-0.5 bg-green-600 text-xs font-medium rounded flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Current
                      </span>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {plan.id === "pro" ? (
                          <Zap className="w-5 h-5 text-indigo-400" />
                        ) : (
                          <Crown className="w-5 h-5 text-amber-400" />
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
                        <span className="text-sm text-green-400">Active</span>
                      ) : isHigher || plan.id === requiredPlan ? (
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={isLoading}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Upgrade"
                          )}
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Lower tier
                        </span>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="mt-3 space-y-1">
                      {plan.features.slice(0, 3).map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-gray-400"
                        >
                          <Check className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
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
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Secure payment via Razorpay. Cancel anytime.
          </p>
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
