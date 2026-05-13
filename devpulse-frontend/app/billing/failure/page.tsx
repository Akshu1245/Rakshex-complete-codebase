"use client";

import Link from "next/link";
import { XCircle, ArrowLeft, LifeBuoy } from "lucide-react";

/**
 * Razorpay hosted-checkout failure / cancellation redirect target.
 * Razorpay does not send an authenticated callback for cancelled checkouts,
 * so this page is a UX-only surface — no server-side state is changed here.
 * The user's plan stays on `free` (or their previous plan) and they can
 * retry from /pricing.
 */
export default function BillingFailurePage() {
  return (
    <div className="text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border border-gray-800 bg-gray-900 shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold">Payment didn&apos;t complete</h1>
        <p className="text-gray-400 mt-2">
          We didn&apos;t receive confirmation from Razorpay. This usually means
          the checkout was cancelled, or your card was declined. No money has
          been charged, and your current plan is unchanged.
        </p>

        <div className="mt-6 rounded-md border border-gray-800 bg-gray-950 p-4 text-left text-sm text-gray-400">
          <p className="font-semibold text-gray-200 mb-2">What to try next</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Retry with a different card or UPI method.</li>
            <li>
              Check that your bank&apos;s international / recurring-payment
              setting is enabled.
            </li>
            <li>
              If you were charged but the plan didn&apos;t activate, contact{" "}
              <a
                href="mailto:support@devpulse.in"
                className="text-blue-400 hover:underline"
              >
                support@devpulse.in
              </a>{" "}
              with the Razorpay Order ID from your bank statement.
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-8 justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Try again
          </Link>
          <a
            href="mailto:support@devpulse.in?subject=DevPulse%20payment%20failed"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-700 hover:bg-gray-800 text-gray-200 text-sm font-medium transition-colors"
          >
            <LifeBuoy className="w-4 h-4" /> Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
