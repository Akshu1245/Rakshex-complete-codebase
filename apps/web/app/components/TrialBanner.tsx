"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { X, Crown } from "lucide-react";

export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const planQuery = trpc.payment.getCurrentPlan.useQuery();

  if (dismissed) return null;

  const trial = planQuery.data?.trial;
  if (!trial?.isTrial) return null;

  const daysLeft = trial.daysLeft;
  const urgency = daysLeft <= 3 ? "bg-[#EF4444]" : daysLeft <= 7 ? "bg-[#FDB022]" : "bg-[#3B82F6]";

  return (
    <div className={`${urgency} text-white px-4 py-2 text-sm`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4" />
          <span>
            You are on a <strong>14-day Pro trial</strong>.
            {daysLeft > 0 ? (
              <>
                {" "}
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} left.
              </>
            ) : (
              <> Trial ends today.</>
            )}{" "}
            <Link href="/billing" className="underline font-medium hover:text-white/90">
              Upgrade to keep Pro features →
            </Link>
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss trial banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
