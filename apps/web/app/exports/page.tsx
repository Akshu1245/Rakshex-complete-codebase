"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const FORMATS = ["json", "csv", "ndjson", "pdf"] as const;
type ExportFormat = (typeof FORMATS)[number];
type ExportResource =
  "token_usage" | "scan_history" | "gateway_audit" | "alert_events" | "alert_rules" | "policies";

export default function DataExportsPage() {
  const { data: resources, isLoading } = trpc.dataExport.listResources.useQuery();
  const [resource, setResource] = useState<ExportResource | "">("");
  const [format, setFormat] = useState<ExportFormat>("json");
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState<string | null>(null);

  const prepare = trpc.dataExport.prepare.useMutation({
    onSuccess: (data) => {
      setMessage(`Prepared ${data.recordCount} rows — downloading…`);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      window.location.href = `${apiBase}/api/internal/data-export/${data.token}`;
    },
    onError: (err) => setMessage(err.message),
  });

  const inline = trpc.dataExport.inline.useMutation({
    onSuccess: (data) => {
      const bytes = Uint8Array.from(atob(data.bodyBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${data.recordCount} rows (${data.sha256.slice(0, 12)}…)`);
    },
    onError: (err) => setMessage(err.message),
  });

  const selected = (resource || resources?.[0]?.id || "") as ExportResource;

  return (
    <div className="min-h-screen text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Data exports</h1>
            <p className="text-gray-400 mt-1">
              Export gateway audit, scans, and related records for buyer due diligence.
            </p>
          </div>
          <Link href="/compliance" className="text-blue-400 hover:text-blue-300 text-sm">
            Compliance →
          </Link>
        </div>

        {isLoading ? (
          <p className="text-gray-500">Loading resources…</p>
        ) : (
          <div className="space-y-6 p-6 rounded-lg border border-gray-700 bg-black/40">
            <label className="block text-sm">
              <span className="text-gray-400">Resource</span>
              <select
                className="mt-1 w-full bg-black border border-gray-700 rounded-lg px-3 py-2"
                value={selected}
                onChange={(e) => setResource(e.target.value as ExportResource)}
              >
                {(resources ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-gray-400">Format</span>
              <select
                className="mt-1 w-full bg-black border border-gray-700 rounded-lg px-3 py-2"
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-gray-400">Window (days)</span>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 30)}
                className="mt-1 w-full bg-black border border-gray-700 rounded-lg px-3 py-2"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!selected || inline.isPending}
                onClick={() => inline.mutate({ resource: selected, format, days })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium"
              >
                {inline.isPending ? "Exporting…" : "Inline download"}
              </button>
              <button
                type="button"
                disabled={!selected || prepare.isPending}
                onClick={() => prepare.mutate({ resource: selected, format, days })}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium"
              >
                {prepare.isPending ? "Preparing…" : "Prepare + stream"}
              </button>
            </div>

            {message && <p className="text-sm text-gray-400 font-mono">{message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
