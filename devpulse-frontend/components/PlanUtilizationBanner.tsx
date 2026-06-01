"use client";

import Link from "next/link";
import { AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Window = {
  used: number;
  limit: number | null;
  pct: number;
  resetsAt?: number;
  status: "ok" | "warning" | "critical";
};

/**
 * Renders a proactive warning banner when the user approaches a plan limit.
 * - `ok` (<70%): render nothing
 * - `warning` (70-89%): yellow banner with soft upsell
 * - `critical` (90-100%): red banner with hard upsell
 *
 * Uses the `utilization` field returned by `payments.getCurrentPlan` via tRPC.
 */
export default function PlanUtilizationBanner() {
  const planQuery = trpc.payment.getCurrentPlan.useQuery(undefined, {
    retry: false,
  });
  const current = planQuery.data as
    | {
        plan: "free" | "pro" | "enterprise";
        status: string;
        utilization?: {
          collections: Window;
          scansPerDay: Window;
        };
      }
    | undefined;

  if (!current?.utilization) return null;

  const { collections, scansPerDay } = current.utilization;
  // Pick the single "most urgent" window — rendering both at once is noisy.
  const worst = pickWorst([
    { key: "scansPerDay", window: scansPerDay, label: "daily scans" },
    { key: "collections", window: collections, label: "collections" },
  ]);
  if (!worst || worst.window.status === "ok") return null;

  const isCritical = worst.window.status === "critical";
  const color = isCritical
    ? {
        wrap: "bg-red-500/10 border-red-500/40 text-red-100",
        icon: "text-red-400",
        bar: "bg-red-500",
      }
    : {
        wrap: "bg-yellow-500/10 border-yellow-500/40 text-yellow-100",
        icon: "text-yellow-400",
        bar: "bg-yellow-400",
      };

  const suggested = current.plan === "free" ? "Pro" : current.plan === "pro" ? "Enterprise" : null; // Enterprise users — no higher tier to suggest
  const resetLabel =
    worst.window.resetsAt && worst.key === "scansPerDay"
      ? formatRelative(worst.window.resetsAt)
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex flex-col sm:flex-row sm:items-center gap-4 rounded-lg border p-4 ${color.wrap}`}
    >
      <div className={`flex items-center gap-3 ${color.icon}`}>
        {isCritical ? (
          <AlertTriangle className="w-5 h-5 shrink-0" />
        ) : (
          <TrendingUp className="w-5 h-5 shrink-0" />
        )}
        <div className="text-sm">
          <div className="font-semibold">
            {isCritical
              ? `You've used ${worst.window.pct}% of your ${worst.label}`
              : `Approaching your ${worst.label} limit · ${worst.window.pct}% used`}
          </div>
          <div className="text-xs opacity-80 mt-0.5">
            {worst.window.used} of {worst.window.limit ?? "∞"} used
            {resetLabel ? ` · resets ${resetLabel}` : ""}
          </div>
        </div>
      </div>

      <div className="flex-1 hidden sm:block">
        <div className="h-2 rounded-full bg-black/50 overflow-hidden">
          <div className={`h-full ${color.bar}`} style={{ width: `${worst.window.pct}%` }} />
        </div>
      </div>

      {suggested ? (
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors shrink-0"
        >
          Upgrade to {suggested} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ) : (
        <span className="text-xs text-gray-400 shrink-0">Contact support for higher limits</span>
      )}
    </div>
  );
}

function pickWorst<T extends { window: Window }>(xs: T[]): T | null {
  const rank = (w: Window) => (w.status === "critical" ? 2 : w.status === "warning" ? 1 : 0);
  let best: T | null = null;
  for (const x of xs) {
    if (!best || rank(x.window) > rank(best.window) || x.window.pct > best.window.pct) {
      best = x;
    }
  }
  return best;
}

function formatRelative(epochMs: number): string {
  const diffMs = epochMs - Date.now();
  if (diffMs <= 0) return "soon";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}
