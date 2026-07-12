"use client";
import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { trpc } from "@/lib/trpc";

export default function KillSwitchPage() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.killSwitch.getSettings.useQuery();
  const auditQuery = trpc.killSwitch.getAuditTrail.useQuery();
  const settings = settingsQuery.data;
  const events = auditQuery.data?.events ?? [];
  const loading = settingsQuery.isLoading || auditQuery.isLoading;

  const [budgetInput, setBudgetInput] = useState("");
  const [triggerReason, setTriggerReason] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showTriggerConfirm, setShowTriggerConfirm] = useState(false);

  const refresh = () => {
    utils.killSwitch.getSettings.invalidate();
    utils.killSwitch.getAuditTrail.invalidate();
  };

  const setBudget = trpc.killSwitch.setBudget.useMutation({
    onSuccess: () => {
      setBudgetInput("");
      refresh();
    },
    onError: (err: { message: string }) => setError(err.message),
  });
  const triggerMutation = trpc.killSwitch.trigger.useMutation({
    onSuccess: () => {
      setTriggerReason("");
      refresh();
    },
    onError: (err: { message: string }) => setError(err.message),
  });
  const resetMutation = trpc.killSwitch.reset.useMutation({
    onSuccess: () => {
      setResetReason("");
      refresh();
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const handleSetBudget = () => {
    const value = parseFloat(budgetInput);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Budget must be a positive number.");
      return;
    }
    setError(null);
    setBudget.mutate({ budgetLimitUSD: value });
  };

  const handleTriggerConfirm = () => {
    if (!triggerReason.trim()) {
      setError("Please provide a reason for triggering the kill switch.");
      return;
    }
    setError(null);
    triggerMutation.mutate({ reason: triggerReason });
    setShowTriggerConfirm(false);
  };

  const handleReset = () => {
    if (!resetReason.trim()) return;
    setError(null);
    resetMutation.mutate({ reason: resetReason });
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Kill Switch</h1>
            <p className="text-gray-400 mt-1">Budget management and LLM operation control</p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            ← Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Budget Configuration</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Monthly Budget Limit ($)
                    </label>
                    <input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      placeholder="1000.00"
                      className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSetBudget}
                    disabled={setBudget.isPending}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {setBudget.isPending ? "Saving…" : "Set Budget"}
                  </button>
                </div>
              </div>

              <div
                className={`p-6 rounded-lg border ${settings?.isActive ? "bg-red-900/30 border-red-500" : "bg-black/50 border-gray-700"}`}
              >
                <h2 className="text-xl font-semibold mb-4">Status</h2>
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className={`w-3 h-3 rounded-full ${settings?.isActive ? "bg-red-500" : "bg-green-500"}`}
                  ></div>
                  <span className="text-lg font-bold">
                    {settings?.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                {settings && (
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>Budget: ${settings.budgetLimitUSD.toFixed(2)}/mo</div>
                    <div>Spent this period: ${settings.currentSpendUSD.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Kill Switch Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trigger Kill Switch</label>
                  <textarea
                    value={triggerReason}
                    onChange={(e) => setTriggerReason(e.target.value)}
                    placeholder="Describe why you are triggering the kill switch..."
                    className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">{triggerReason.length}/500</p>
                  <button
                    onClick={() => {
                      if (!triggerReason.trim()) {
                        setError("Please provide a reason for triggering the kill switch.");
                        return;
                      }
                      setError(null);
                      setShowTriggerConfirm(true);
                    }}
                    disabled={triggerMutation.isPending}
                    className="mt-2 w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {triggerMutation.isPending ? "Triggering…" : "Trigger Now"}
                  </button>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Reset Kill Switch</label>
                  <textarea
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    placeholder="Describe why you are resetting the kill switch..."
                    className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">{resetReason.length}/500</p>
                  <button
                    onClick={handleReset}
                    disabled={resetMutation.isPending}
                    className="mt-2 w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {resetMutation.isPending ? "Resetting…" : "Reset"}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Audit Trail</h2>
              {events.length === 0 ? (
                <EmptyState
                  compact
                  icon={<span>🛑</span>}
                  title="No kill-switch events yet"
                  description="Trigger a manual stop above or hit your budget limit to see events recorded here."
                />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="bg-black/50 p-3 rounded-lg border border-gray-700"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className={`text-sm font-bold ${
                            event.eventType === "triggered"
                              ? "text-red-400"
                              : event.eventType === "reset"
                                ? "text-green-400"
                                : "text-blue-400"
                          }`}
                        >
                          {event.eventType.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {event.reason && <p className="text-sm text-gray-300">{event.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kill Switch Trigger Confirmation Modal */}
      <ConfirmModal
        open={showTriggerConfirm}
        title="Trigger Kill Switch?"
        message="This will immediately halt ALL LLM operations across your organization. Every AI agent, API call, and gateway request will be blocked until the kill switch is reset. This is a critical action."
        confirmLabel="Yes, Trigger Kill Switch"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleTriggerConfirm}
        onCancel={() => setShowTriggerConfirm(false)}
      />
    </div>
  );
}
