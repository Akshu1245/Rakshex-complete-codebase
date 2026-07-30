"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (payload: unknown) => void) => void;
    };
  }
}

function formatMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

async function ensureRazorpay(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

export function WorkspaceSubscriptionCard({ workspaceId }: { workspaceId: number }) {
  const utils = trpc.useUtils();
  const query = trpc.payment.getWorkspaceSubscription.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const plans = query.data?.availablePlans ?? [];
  const subscription = query.data?.subscription;
  const [plan, setPlan] = useState<"pro" | "enterprise">("pro");
  const selectedPlan = useMemo(() => plans.find((item) => item.plan === plan), [plan, plans]);
  const [seatCount, setSeatCount] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (subscription) {
      setPlan(subscription.plan as "pro" | "enterprise");
      setSeatCount(subscription.seatCount);
    } else if (selectedPlan) {
      setSeatCount(Math.max(1, query.data?.reservedSeats ?? 1));
    }
  }, [query.data?.reservedSeats, selectedPlan, subscription]);

  const create = trpc.payment.createWorkspaceSubscription.useMutation({
    onSuccess: async (result) => {
      try {
        await ensureRazorpay();
        if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable");
        const checkout = new window.Razorpay({
          key: result.keyId,
          subscription_id: result.subscriptionId,
          name: "Rakshex",
          description: `${result.plan === "enterprise" ? "Business" : "Pro"} team subscription`,
          handler: () => {
            setMessage(
              "Payment received. Activation will update after the signed webhook arrives.",
            );
            void utils.payment.getWorkspaceSubscription.invalidate({ workspaceId });
          },
          theme: { color: "#14B8A6" },
        });
        checkout.on("payment.failed", () => setMessage("Payment failed. No plan was activated."));
        checkout.open();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not open checkout");
      }
    },
    onError: (error) => setMessage(error.message),
  });

  const updateSeats = trpc.payment.updateWorkspaceSeats.useMutation({
    onSuccess: () => {
      setMessage("Seat allocation updated.");
      void query.refetch();
    },
    onError: (error) => setMessage(error.message),
  });

  const cancel = trpc.payment.cancelWorkspaceSubscription.useMutation({
    onSuccess: () => {
      setMessage("Cancellation recorded.");
      void query.refetch();
    },
    onError: (error) => setMessage(error.message),
  });

  if (query.isLoading) {
    return <p className="text-sm text-neutral-500">Loading team subscription…</p>;
  }

  if (query.error) {
    return (
      <p className="text-sm text-neutral-500">
        Subscription details are visible to workspace owners and billing administrators.
      </p>
    );
  }

  const reservedSeats = query.data?.reservedSeats ?? 0;
  const maxSeats = selectedPlan?.includedSeats ?? 1;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-medium">Team subscription</h2>
        <p className="mt-1 text-sm text-neutral-500">
          One workspace plan controls included seats and paid feature access for every active
          member.
        </p>
      </div>

      {subscription ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-neutral-900 p-3">
              <p className="text-xs text-neutral-500">Plan</p>
              <p className="mt-1 capitalize">{subscription.plan}</p>
            </div>
            <div className="rounded-md bg-neutral-900 p-3">
              <p className="text-xs text-neutral-500">Status</p>
              <p className="mt-1 capitalize">{subscription.status.replace("_", " ")}</p>
            </div>
            <div className="rounded-md bg-neutral-900 p-3">
              <p className="text-xs text-neutral-500">Billing</p>
              <p className="mt-1">
                {formatMinor(subscription.amountMinor, subscription.currency)}/month
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-neutral-400">
                Seats ({reservedSeats} currently reserved)
              </span>
              <input
                type="number"
                min={reservedSeats}
                max={maxSeats}
                value={seatCount}
                onChange={(event) => setSeatCount(Number(event.target.value))}
                className="w-28 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={updateSeats.isPending}
              onClick={() => updateSeats.mutate({ workspaceId, seatCount })}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm disabled:opacity-50"
            >
              Update seats
            </button>
            <button
              type="button"
              disabled={cancel.isPending || subscription.status === "cancelled"}
              onClick={() => cancel.mutate({ workspaceId, immediately: false })}
              className="rounded-md border border-red-700 px-4 py-2 text-sm text-red-300 disabled:opacity-50"
            >
              Cancel at period end
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((item) => (
              <button
                type="button"
                key={item.plan}
                onClick={() => setPlan(item.plan)}
                className={`rounded-md border p-4 text-left ${
                  plan === item.plan ? "border-teal-500 bg-teal-950/20" : "border-neutral-700"
                }`}
              >
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-sm text-neutral-400">
                  {formatMinor(item.amountMinor, item.currency)}/month · up to {item.includedSeats}{" "}
                  seats
                </p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-neutral-400">
                Allocate seats ({reservedSeats} required)
              </span>
              <input
                type="number"
                min={Math.max(1, reservedSeats)}
                max={maxSeats}
                value={seatCount}
                onChange={(event) => setSeatCount(Number(event.target.value))}
                className="w-28 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={create.isPending || seatCount < reservedSeats || seatCount > maxSeats}
              onClick={() => create.mutate({ workspaceId, plan, seatCount })}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm disabled:opacity-50"
            >
              Subscribe workspace
            </button>
          </div>
        </>
      )}

      {message && <p className="text-sm text-neutral-300">{message}</p>}
    </div>
  );
}
