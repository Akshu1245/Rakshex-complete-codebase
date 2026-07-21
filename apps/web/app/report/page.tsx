"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const RECENT_KEY = "rakshex.recentScanReports";

type RecentReport = {
  id: string;
  score: number;
  findingCount: number;
  filename?: string;
  createdAt: string;
};

function loadRecent(): RecentReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(items: RecentReport[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 25)));
}

function scoreFromFindings(findings: { severity: string }[]): number {
  if (findings.length === 0) return 100;
  const weights: Record<string, number> = {
    Critical: 25,
    High: 15,
    Medium: 8,
    Low: 3,
  };
  const penalty = findings.reduce((s, f) => s + (weights[f.severity] ?? 5), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export default function ReportListPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const [openId, setOpenId] = useState("");

  const findingsQuery = trpc.findings.list.useQuery({ limit: 100 });
  const createReport = trpc.reports.create.useMutation({
    onSuccess: (data) => {
      const findings = findingsQuery.data?.findings ?? [];
      const entry: RecentReport = {
        id: data.reportId,
        score: scoreFromFindings(findings),
        findingCount: findings.length,
        filename: "workspace-findings",
        createdAt: new Date().toISOString(),
      };
      const next = [entry, ...recent.filter((r) => r.id !== entry.id)];
      setRecent(next);
      saveRecent(next);
      addToast("success", "Report generated");
      router.push(`/report/${data.reportId}`);
    },
    onError: (err) => addToast("error", err.message),
  });

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const findings = findingsQuery.data?.findings ?? [];
  const previewScore = useMemo(() => scoreFromFindings(findings), [findings]);

  const handleGenerate = () => {
    if (findings.length === 0) {
      addToast("error", "No findings to include — run a scan first");
      return;
    }
    createReport.mutate({
      score: previewScore,
      filename: "workspace-findings",
      endpoints: Array.from(
        new Set(findings.map((f) => f.endpoint).filter((e): e is string => Boolean(e))),
      ).slice(0, 100),
      findings: findings.slice(0, 200).map((f) => ({
        title: f.title,
        severity: f.severity as "Critical" | "High" | "Medium" | "Low",
        endpoint: f.endpoint ?? "unknown",
        description: f.description ?? undefined,
        remediation: f.remediation ?? undefined,
      })),
    });
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
                : `${findings.length} findings · estimated score ${previewScore}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={createReport.isPending || findingsQuery.isLoading || findings.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md text-sm font-semibold"
          >
            {createReport.isPending ? "Generating…" : "Generate report"}
          </button>
        </div>
        {findings.length === 0 && !findingsQuery.isLoading && (
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
        <h2 className="text-lg font-semibold mb-3">Recently generated (this browser)</h2>
        {recent.length === 0 ? (
          <EmptyState
            compact
            title="No recent reports"
            description="Generated reports appear here so you can reopen them. Shareable links work via /report/[id]."
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/report/${r.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/50"
                >
                  <div>
                    <p className="font-mono text-sm text-blue-300">{r.id}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Score {r.score} · {r.findingCount} findings ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">View →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
