"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi, useApiMutation, apiFetch, ApiError } from "@/lib/api";
import { NotConnectedState } from "@/components/NotConnected";

const SEVERITY_STYLE: Record<string, string> = {
  Critical: "text-red-400",
  High: "text-orange-400",
  Medium: "text-yellow-400",
  Low: "text-blue-400",
};

interface FindingRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  confidence?: string;
  fingerprint?: string;
  endpoint?: string;
}

interface FindingDetail extends FindingRow {
  description?: string;
  remediation?: string;
  ruleId?: string;
}

export default function FindingsPage() {
  const [status, setStatus] = useState<string | undefined>();
  const [severity, setSeverity] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [exportFmt, setExportFmt] = useState<"json" | "csv" | "sarif">("json");
  const [actionError, setActionError] = useState<string | null>(null);

  // Findings have no /v1 equivalent on the Workers deployment —
  // /api/findings answers 501 not_connected. Mutations surface the honest
  // error instead of pretending to change finding state.
  const list = useApi<{ findings: FindingRow[]; groups: unknown[] }>(
    `/api/findings?limit=100${status ? `&status=${encodeURIComponent(status)}` : ""}${
      severity ? `&severity=${encodeURIComponent(severity)}` : ""
    }`,
  );
  const detail = useApi<{ finding: FindingDetail }>(
    selected ? `/api/findings?id=${encodeURIComponent(selected)}` : null,
  );
  const updateStatus = useApiMutation<
    { id: string; status: string; reason?: string; expiresAt?: string },
    unknown
  >("/api/findings", "PATCH");
  const bulk = useApiMutation<{ ids: string[]; status: string; reason?: string }, unknown>(
    "/api/findings",
    "POST",
  );

  const findings = list.data?.findings ?? [];
  const groups = list.data?.groups ?? [];

  const runUpdateStatus = (id: string, st: string, label: string) => {
    setActionError(null);
    updateStatus.mutate(
      {
        id,
        status: st,
        reason: `Marked ${label} from UI`,
        ...(st === "suppressed"
          ? { expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() }
          : {}),
      },
      {
        onSuccess: () => {
          list.refetch();
          detail.refetch();
        },
        onError: (err) => setActionError(err.message),
      },
    );
  };

  const downloadExport = async () => {
    setActionError(null);
    try {
      const res = await apiFetch<{ body?: string }>(
        `/api/findings?format=${encodeURIComponent(exportFmt)}`,
      );
      const body = res.body ?? "";
      const blob = new Blob([body], {
        type: exportFmt === "csv" ? "text/csv" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `findings.${exportFmt === "sarif" ? "sarif.json" : exportFmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Export failed — the backend is not connected.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Findings</h1>
          <p className="text-neutral-500 text-sm">
            Severity, confidence, suppression, accepted risk, and export
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/collections" className="text-teal-400">
            Collections
          </Link>
          <Link href="/scanning" className="text-teal-400">
            Scans
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={status ?? ""}
          onChange={(e) => setStatus(e.target.value || undefined)}
        >
          <option value="">All statuses</option>
          {[
            "open",
            "in-progress",
            "resolved",
            "suppressed",
            "false_positive",
            "accepted_risk",
            "reopened",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={severity ?? ""}
          onChange={(e) => setSeverity(e.target.value || undefined)}
        >
          <option value="">All severities</option>
          {["Critical", "High", "Medium", "Low"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          value={exportFmt}
          onChange={(e) => setExportFmt(e.target.value as "json" | "csv" | "sarif")}
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="sarif">SARIF</option>
        </select>
        <button
          type="button"
          onClick={downloadExport}
          className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm"
        >
          Export
        </button>
        <button
          type="button"
          className="px-3 py-2 border border-red-900 text-red-300 rounded text-sm"
          onClick={() => {
            const ids = findings.slice(0, 10).map((f) => f.id);
            if (!ids.length) return;
            setActionError(null);
            bulk.mutate(
              { ids, status: "resolved", reason: "bulk resolve" },
              {
                onSuccess: () => list.refetch(),
                onError: (err) => setActionError(err.message),
              },
            );
          }}
        >
          Bulk resolve (page)
        </button>
      </div>

      {actionError && (
        <p className="text-red-400 text-sm mb-4" role="alert">
          {actionError}
        </p>
      )}

      {list.notConnected ? (
        <NotConnectedState
          resource="Findings"
          detail="Listing findings, changing their status and exporting them needs the findings backend, which isn't connected on this deployment yet. Nothing is shown or changed here."
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs text-neutral-500 mb-2">
              {findings.length} findings · {groups.length} fingerprint groups
            </p>
            {list.isLoading && <p className="text-neutral-500">Loading…</p>}
            {findings.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelected(f.id)}
                className={`w-full text-left border rounded-lg p-3 text-sm transition-colors ${
                  selected === f.id
                    ? "border-teal-600 bg-teal-950/30"
                    : "border-neutral-800 hover:border-neutral-600"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{f.title}</span>
                  <span className={SEVERITY_STYLE[f.severity] ?? ""}>{f.severity}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {f.status}
                  {f.confidence ? ` · ${f.confidence}` : ""}
                  {f.endpoint ? ` · ${f.endpoint}` : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="border border-neutral-800 rounded-lg p-4 min-h-[320px]">
            {!selected && (
              <p className="text-neutral-500 text-sm">Select a finding for detail and actions.</p>
            )}
            {detail.data?.finding && (
              <div className="space-y-3 text-sm">
                <h2 className="text-lg font-semibold">{detail.data.finding.title}</h2>
                <p className="text-neutral-400">{detail.data.finding.description}</p>
                <p className="text-xs text-neutral-500">
                  rule: {detail.data.finding.ruleId ?? "—"} · fp:{" "}
                  {detail.data.finding.fingerprint ?? "—"}
                </p>
                <p className="text-neutral-300 whitespace-pre-wrap">
                  {detail.data.finding.remediation}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {(
                    [
                      ["suppress", "suppressed"],
                      ["false positive", "false_positive"],
                      ["accept risk", "accepted_risk"],
                      ["reopen", "reopened"],
                      ["resolve", "resolved"],
                    ] as const
                  ).map(([label, st]) => (
                    <button
                      key={st}
                      type="button"
                      disabled={updateStatus.isPending}
                      className="px-2 py-1 border border-neutral-700 rounded text-xs hover:bg-neutral-900 disabled:opacity-50"
                      onClick={() => runUpdateStatus(selected!, st, label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
