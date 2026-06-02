"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

export default function FeatureFlagsAdminPage() {
  const utils = trpc.useUtils();
  const { addToast } = useToast();
  const flagsQuery = trpc.featureFlags.listAll.useQuery();

  const upsert = trpc.featureFlags.upsert.useMutation({
    onSuccess: () => {
      utils.featureFlags.listAll.invalidate();
      addToast("success", "Flag saved");
      setNewKey("");
      setNewDesc("");
      setNewPct(0);
    },
    onError: (e) => addToast("error", e.message),
  });
  const toggle = trpc.featureFlags.toggle.useMutation({
    onSuccess: () => utils.featureFlags.listAll.invalidate(),
    onError: (e) => addToast("error", e.message),
  });

  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPct, setNewPct] = useState(0);

  const flags = flagsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Feature Flags</h1>
            <p className="text-gray-400 mt-1">
              Toggle features at runtime and roll out gradually by percentage.
            </p>
          </div>
          <Link href="/admin" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Admin
          </Link>
        </div>

        {/* Create / update */}
        <div className="mb-8 rounded-xl border border-[#2D3E50] bg-black/40 p-5">
          <h2 className="font-semibold mb-4">Create or update a flag</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="flag_key (e.g. waitlist_sheets_sync)"
              className="bg-black/50 border border-[#2D3E50] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#06D6A0]/50"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description"
              className="bg-black/50 border border-[#2D3E50] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#06D6A0]/50"
            />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="text-sm text-gray-400 flex items-center gap-2">
              Rollout %
              <input
                type="number"
                min={0}
                max={100}
                value={newPct}
                onChange={(e) => setNewPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-20 bg-black/50 border border-[#2D3E50] rounded-lg px-2 py-1 text-sm"
              />
            </label>
            <button
              onClick={() =>
                upsert.mutate({
                  key: newKey.trim(),
                  description: newDesc.trim(),
                  enabled: true,
                  rolloutPercentage: newPct,
                })
              }
              disabled={!newKey.trim() || upsert.isPending}
              className="px-4 py-2 rounded-lg bg-[#06D6A0] text-[#0A0E1A] text-sm font-semibold disabled:opacity-40"
            >
              Save flag
            </button>
          </div>
        </div>

        {/* List */}
        {flagsQuery.isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl border border-[#2D3E50] bg-black/40 animate-pulse" />
            ))}
          </div>
        )}

        {!flagsQuery.isLoading && flags.length === 0 && (
          <EmptyState
            icon="🚩"
            title="No feature flags yet"
            description="Create your first flag above to gate features without a redeploy."
          />
        )}

        {!flagsQuery.isLoading && flags.length > 0 && (
          <div className="space-y-3">
            {flags.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[#2D3E50] bg-black/40"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white">{f.key}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{f.description || "—"}</p>
                  <p className="text-gray-500 text-xs mt-1">Rollout: {f.rolloutPercentage}%</p>
                </div>
                <button
                  onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    f.enabled
                      ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30"
                      : "bg-gray-700/40 text-gray-400 border border-gray-600/40"
                  }`}
                >
                  {f.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
