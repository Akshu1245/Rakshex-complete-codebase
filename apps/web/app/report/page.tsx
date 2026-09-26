"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi, useApiMutation } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

interface FindingItem {
  scanId?: string;
}

interface ReportItem {
  id: string;
  score: number;
  findingCount: number;
  createdAt: string;
  revokedAt?: string | null;
  expiresAt?: string | null;
}

export default function ReportListPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [openId, setOpenId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);

  const findingsQuery = useApi<{ findings: FindingItem[] }>("/api/findings?limit=100");
  const reportsQuery = useApi<ReportItem[]>("/api/reports");
  const createReport = useApiMutation<
    { scanId: string; expiresInDays: number },
    { reportId: string }
  >("/api/reports", "POST");
  const revokeReport = useApiMutation<{ id: string }, unknown>("/api/reports", "DELETE");

  const handleGenerateSuccess = (data: { reportId: string }) => {
    reportsQuery.refetch();
    addToast("success", "Report generated");
    router.push(`/report/${data.reportId}`);
  };
  const handleGenerateError = (err: { message: string }) => addToast("error", err.message);
  const handleRevokeSuccess = () => {
    reportsQuery.refetch();
    addToast("success", "Report revoked");
  };
  const handleRevokeError = (err: { message: string }) => addToast("error", err.message);

  const findings = findingsQuery.data?.findings ?? [];
  const latestScanId = findings[0]?.scanId;
  const reportsNotConnected = findingsQuery.notConnected || reportsQuery.notConnected;

  const handleGenerate = () => {
    if (!latestScanId) {
      addToast("error", "No findings to include — run a scan first");
      return;
    }
    createReport.mutate(
      {
        scanId: latestScanId,
        expiresInDays,
      },
      { onSuccess: handleGenerateSuccess, onError: handleGenerateError },
    );
  };

  return (
    <div className="text-white p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">Scan Reports</h1>
          <p className="text-gray-400 mt-1">
            Generate a shareable report from your current findings, or open an existing report ID.
          </p>
        </div>
        <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm">
          ← Dashboard
        </Link>
      </div>

      <div className="bg-black/50 border border-gray-700 rounded-lg p-6 mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Generate from findings</h2>
            <p className="text-sm text-gray-400 mt-1">
              {findingsQuery.isLoading
                ? "Loading findings…"
                : latestScanId
                  ? `Latest scan ${latestScanId} · server-derived, tamper-resistant snapshot`
                  : "No completed scan findings available"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm"
              aria-label="Report expiry"
            >
              <option value={7}>Expires in 7 days</option>
              <option value={30}>Expires in 30 days</option>
              <option value={90}>Expires in 90 days</option>
            </select>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={createReport.isPending || findingsQuery.isLoading || !latestScanId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md text-sm font-semibold"
            >
              {createReport.isPending ? "Generating…" : "Generate report"}
            </button>
          </div>
        </div>
        {!latestScanId && !findingsQuery.isLoading && (
          <EmptyState
            compact
            title="No findings to report"
            description="Run a collection scan first, then generate a shareable report."
            actions={[{ label: "Go to scanning", href: "/scanning", variant: "secondary" }]}
          />
        )}
      </div>

      <div className="bg-black/50 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3">Open by report ID</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = openId.trim();
            if (!id) return;
            router.push(`/report/${id}`);
          }}
        >
          <input
            value={openId}
            onChange={(e) => setOpenId(e.target.value)}
            placeholder="Report ID"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 border border-gray-500 rounded-md text-sm hover:bg-gray-700"
          >
            Open
          </button>
        </form>
      </div>

      <div className="bg-black/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">Your generated reports</h2>
        {reportsNotConnected ? (
          <p className="text-sm text-gray-400">
            Reports aren&apos;t connected on this deployment yet — nothing is listed and generation
            will fail until the backend is connected.
          </p>
        ) : reportsQuery.isLoading ? (
          <p className="text-sm text-gray-400">Loading reports…</p>
        ) : !reportsQuery.data?.length ? (
          <EmptyState
            compact
            title="No recent reports"
            description="Authenticated, expiring reports you create will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {reportsQuery.data.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border border-gray-700"
              >
                <Link href={`/report/${r.id}`} className="min-w-0 flex-1 hover:border-blue-500/50">
                  <p className="font-mono text-sm text-blue-300">{r.id}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Score {r.score} · {r.findingCount} findings ·{" "}
                    {new Date(r.createdAt).toLocaleString()}
                    {r.revokedAt
                      ? " · revoked"
                      : r.expiresAt
                        ? ` · expires ${new Date(r.expiresAt).toLocaleDateString()}`
                        : ""}
                  </p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {!r.revokedAt && (
                    <button
                      type="button"
                      className="text-xs px-3 py-1.5 rounded-md border border-red-500/40 text-red-300 hover:bg-red-900/20"
                      disabled={revokeReport.isPending}
                      onClick={() => {
                        if (confirm("Revoke this shareable report link?")) {
                          revokeReport.mutate(
                            { id: r.id },
                            { onSuccess: handleRevokeSuccess, onError: handleRevokeError },
                          );
                        }
                      }}
                    >
                      Revoke
                    </button>
                  )}
                  <Link href={`/report/${r.id}`} className="text-sm text-gray-400">
                    View →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
