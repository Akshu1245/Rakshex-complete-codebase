"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, CreditCard, Download, AlertCircle, Check, X, Crown, Zap } from "lucide-react";

interface Invoice {
  id: string;
  razorpayPaymentId: string;
  amount: string;
  currency: string;
  status: string;
  receipt: string | null;
  description: string | null;
  createdAt: string | Date;
}

interface Plan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  features: string[];
  limits: Record<string, unknown>;
}

export default function BillingPage() {
  const utils = trpc.useUtils();
  const planQuery = trpc.payment.getCurrentPlan.useQuery();
  const invoicesQuery = trpc.payment.getInvoices.useQuery();
  const plansQuery = trpc.payment.getPlans.useQuery();

  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [oneTimeAmount, setOneTimeAmount] = useState<number>(500);
  const [isPayingOneTime, setIsPayingOneTime] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  const subscription = planQuery.data ?? null;
  const invoices: Invoice[] = (invoicesQuery.data?.invoices ?? []) as Invoice[];
  const plans: Plan[] = (plansQuery.data ?? []) as Plan[];
  const isLoading = planQuery.isLoading || invoicesQuery.isLoading || plansQuery.isLoading;

  const refreshAll = () => {
    utils.payment.getCurrentPlan.invalidate();
    utils.payment.getInvoices.invalidate();
  };

  const createSubscription = trpc.payment.createSubscription.useMutation({
    onError: (err: { message: string }) => {
      setError(err.message || "Failed to create subscription");
    },
  });
  const cancelSubscription = trpc.payment.cancel.useMutation({
    onSuccess: () => {
      setShowCancelConfirm(false);
      refreshAll();
    },
    onError: (err: { message: string }) => {
      setError(err.message || "Failed to cancel subscription");
    },
  });

  const isProcessing = createSubscription.isPending || cancelSubscription.isPending;

  const handleUpgrade = async (planId: string) => {
    if (planId === "free") return;
    setError(null);
    try {
      const result = await createSubscription.mutateAsync({
        plan: planId as "pro" | "enterprise",
      });

      const planRecord = plans.find((p) => p.id === planId);

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        const options = {
          key: result.keyId,
          subscription_id: result.subscriptionId,
          name: "RaksHex",
          description: `${planRecord?.name ?? "RaksHex"} Subscription`,
          image: "/logo.png",
          handler: function () {
            refreshAll();
          },
          theme: {
            color: "#06D6A0",
          },
        };
        const rzp = new (
          window as unknown as {
            Razorpay: new (o: unknown) => { open: () => void };
          }
        ).Razorpay(options);
        rzp.open();
      };
      document.body.appendChild(script);
    } catch {
      // already surfaced via onError
    }
  };

  const handleOneTimePayment = async () => {
    setError(null);
    setPaymentSuccess(false);
    setIsPayingOneTime(true);

    try {
      const amountInPaise = oneTimeAmount * 100;
      if (amountInPaise < 100) {
        throw new Error("Minimum amount is 100 paise (₹1)");
      }

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: `onetime_${Date.now()}`,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.error || "Failed to create payment order");
      }

      const orderData = await orderRes.json();
      const orderId = orderData.order_id;

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SvOVoVW2Cy6jtT",
          amount: orderData.amount,
          currency: orderData.currency,
          name: "RaksHex Standard Checkout",
          description: "One-time API Security Scan Credits",
          order_id: orderId,
          image: "/logo.png",
          handler: async function (response: any) {
            try {
              setIsPayingOneTime(true);
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              if (!verifyRes.ok) {
                const verifyErr = await verifyRes.json();
                throw new Error(verifyErr.error || "Payment signature verification failed");
              }

              setPaymentSuccess(true);
              refreshAll();
            } catch (err: any) {
              setError(err.message || "Failed to verify signature");
            } finally {
              setIsPayingOneTime(false);
            }
          },
          prefill: {
            name: "",
            email: "",
          },
          theme: {
            color: "#14B8A6",
          },
          modal: {
            ondismiss: function () {
              setIsPayingOneTime(false);
              setError("Payment checkout cancelled by user");
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          setError(response.error.description || "Payment failed");
          setIsPayingOneTime(false);
        });
        rzp.open();
      };

      script.onerror = () => {
        throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
      };

      document.body.appendChild(script);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during checkout");
      setIsPayingOneTime(false);
    }
  };

  const handleCancel = (immediately: boolean) => {
    setError(null);
    cancelSubscription.mutate({ immediately });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-[#10B981] bg-[#10B981]/15 border-[#10B981]";
      case "pending":
        return "text-[#FDB022] bg-[#FDB022]/15 border-[#FDB022]";
      case "cancelled":
        return "text-[#EF4444] bg-[#EF4444]/15 border-[#EF4444]";
      case "past_due":
        return "text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]";
      default:
        return "text-[#94A3B8] bg-[#1E293B]/30 border-[#2D3E50]";
    }
  };

  const formatAmount = (amount: string, currency: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
    }).format(num);
  };

  const currentPlan = plans.find((p) => p.id === subscription?.plan);
  const isPaidPlan = !!subscription?.plan && subscription.plan !== "free";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#06D6A0]" />
      </div>
    );
  }

  return (
    <div className="text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-[#06D6A0]" />
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-[#1E293B] border border-[#2D3E50] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Current Plan</h2>

          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold capitalize">
                  {currentPlan?.name || subscription?.plan || "Free"}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(
                    subscription?.status || "none",
                  )}`}
                >
                  {subscription?.status === "active" && isPaidPlan
                    ? "Active"
                    : subscription?.status || "None"}
                </span>
              </div>
            </div>

            {isPaidPlan && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-4 py-2 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 rounded-lg transition-colors"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>

        {/* Available Plans */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#1E293B] border rounded-lg p-6 ${
                subscription?.plan === plan.id
                  ? "border-[#06D6A0] ring-1 ring-[#06D6A0]"
                  : "border-[#2D3E50]"
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                {plan.id === "pro" && <Zap className="w-5 h-5 text-[#06D6A0]" />}
                {plan.id === "enterprise" && <Crown className="w-5 h-5 text-[#FDB022]" />}
                <h3 className="font-semibold">{plan.name}</h3>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: plan.currency,
                  }).format(plan.amount / 100)}
                </span>
                <span className="text-gray-400">/{plan.interval}</span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.slice(0, 4).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {subscription?.plan === plan.id ? (
                <button
                  disabled
                  className="w-full py-2 bg-[#0A0E1A] text-gray-400 rounded-lg cursor-not-allowed border border-[#2D3E50]"
                >
                  Current Plan
                </button>
              ) : plan.id === "free" ? (
                <button
                  disabled={subscription?.plan === "free"}
                  className="w-full py-2 bg-[#0A0E1A] text-gray-400 rounded-lg cursor-not-allowed border border-[#2D3E50]"
                >
                  {subscription?.plan === "free" ? "Current Plan" : "Downgrade"}
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isProcessing}
                  className="w-full py-2 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#0A0E1A]" />
                  ) : subscription?.plan === "free" ? (
                    "Upgrade"
                  ) : (
                    "Switch Plan"
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* One-time Payment Checkout */}
        <div className="bg-[#1E293B] border border-[#2D3E50] rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Buy Custom Scan Credits (One-time Payment)</h2>
            <p className="text-gray-400 text-sm mt-1">
              Need more API scans without upgrading your subscription? Buy extra credits instantly
              using Razorpay Standard Checkout.
            </p>
          </div>

          {paymentSuccess && (
            <div className="flex items-center gap-2 p-4 bg-emerald-950/30 border border-emerald-500 rounded-lg text-emerald-400">
              <Check className="w-5 h-5" />
              Payment completed and verified successfully! Your credits are updated.
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 max-w-md">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2 text-gray-400 font-medium">₹</span>
              <input
                type="number"
                min="1"
                value={oneTimeAmount}
                onChange={(e) => setOneTimeAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full pl-8 pr-3 py-2 bg-[#0A0E1A] border border-[#2D3E50] rounded-lg text-white focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6] placeholder-gray-600"
                placeholder="Enter amount"
                disabled={isPayingOneTime}
              />
            </div>
            <button
              onClick={handleOneTimePayment}
              disabled={isPayingOneTime}
              className="px-6 py-2 bg-gradient-to-r from-[#14B8A6] to-[#00F0FF] text-[#0A0E1A] font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPayingOneTime ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0A0E1A]" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-[#0A0E1A]" />
                  Pay ₹{oneTimeAmount} Now
                </>
              )}
            </button>
          </div>
          <div className="flex gap-2">
            {[100, 500, 1000, 2500].map((amt) => (
              <button
                key={amt}
                onClick={() => setOneTimeAmount(amt)}
                className={`px-3 py-1 text-xs border rounded-lg transition-colors ${
                  oneTimeAmount === amt
                    ? "border-[#14B8A6] bg-[#14B8A6]/10 text-[#14B8A6]"
                    : "border-[#2D3E50] hover:border-gray-500 text-gray-400"
                }`}
                disabled={isPayingOneTime}
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-[#1E293B] border border-[#2D3E50] rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Invoice History</h2>

          {invoices.length === 0 ? (
            <EmptyState
              compact
              icon={<span>🧾</span>}
              title="No invoices yet"
              description="Once you subscribe to a paid plan your receipts and payment history will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm border-b border-[#2D3E50]">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-[#2D3E50]/50 hover:bg-[#06D6A0]/5 transition-colors"
                    >
                      <td className="py-4 text-sm">
                        {format(new Date(invoice.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="py-4 text-sm">
                        {invoice.description || "Subscription payment"}
                      </td>
                      <td className="py-4 text-sm">
                        {formatAmount(invoice.amount, invoice.currency)}
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs border ${getStatusColor(
                            invoice.status,
                          )}`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-4">
                        {invoice.receipt ? (
                          <a
                            href={`https://dashboard.razorpay.com/receipts/${invoice.receipt}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#06D6A0] hover:text-[#00F0FF] text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCancelConfirm(false);
            }}
          >
            <div className="bg-[#1E293B] border border-[#2D3E50] rounded-lg p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-[#EF4444]" />
                <h3 className="text-lg font-semibold">Cancel Subscription?</h3>
              </div>

              <p className="text-gray-300 mb-6">
                You can cancel immediately or at the end of your billing period. If you cancel
                immediately, you&apos;ll lose access to premium features right away.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleCancel(true)}
                  disabled={isProcessing}
                  className="flex-1 py-2 bg-[#EF4444] hover:bg-[#EF4444]/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Cancel Now"
                  )}
                </button>
                <button
                  onClick={() => handleCancel(false)}
                  disabled={isProcessing}
                  className="flex-1 py-2 bg-[#FDB022]/10 hover:bg-[#FDB022]/20 text-[#FDB022] border border-[#FDB022]/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "At Period End"
                  )}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isProcessing}
                  className="flex-1 py-2 bg-[#0A0E1A] hover:bg-gray-800 text-gray-300 border border-[#2D3E50] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
