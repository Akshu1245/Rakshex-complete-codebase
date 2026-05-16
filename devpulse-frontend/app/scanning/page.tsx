"use client";
import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";

type ScanType = "full" | "quick" | "shadow_api" | "prompt_injection";

export default function ScanningPage() {
  const [selectedCollection, setSelectedCollection] = useState("");
  const [scanType, setScanType] = useState<ScanType>("full");
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    riskScore: number;
    riskLevel: string;
    findings: Array<{
      id: string;
      title: string;
      description: string | null;
      severity: string;
      category: string | null;
      remediation: string | null;
      cweId: string | null;
    }>;
  } | null>(null);

  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [queuedScanId, setQueuedScanId] = useState<string | null>(null);

  const collectionsQuery = trpc.collections.list.useQuery();
  const collections = collectionsQuery.data?.collections ?? [];

  const startScan = trpc.scanning.startScan.useMutation({
    onSuccess: (data) => {
      setScanStatus(data.status);
      if (data.status === "queued" && data.scanId) {
        setQueuedScanId(data.scanId);
      }
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const handleScan = () => {
    if (!selectedCollection) return;
    setError(null);
    setScanResult(null);
    setScanStatus(null);
    setQueuedScanId(null);
    startScan.mutate({ collectionId: selectedCollection, scanType });
  };

  const findings = scanResult?.findings ?? [];
  const scanned = !!scanResult || scanStatus === "queued";
  const loading = startScan.isPending;

  const severityColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "critical":
        return "text-red-400 bg-red-900/40 border-red-500";
      case "high":
        return "text-red-300 bg-red-900/30 border-red-500/70";
      case "medium":
        return "text-yellow-400 bg-yellow-900/30 border-yellow-500";
      case "low":
        return "text-blue-400 bg-blue-900/30 border-blue-500";
      default:
        return "text-orange-400 bg-orange-900/30 border-orange-500";
    }
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Security Scanner</h1>
            <p className="text-gray-400 mt-1">Scan code for vulnerabilities and shadow APIs</p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Run a scan</h2>

              <label className="block text-sm text-gray-400 mb-1">Collection</label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full mb-4 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Select a collection --</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>

              <label className="block text-sm text-gray-400 mb-1">Scan type</label>
              <select
                value={scanType}
                onChange={(e) => setScanType(e.target.value as ScanType)}
                className="w-full mb-4 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="full">Full (all checks)</option>
                <option value="quick">Quick</option>
                <option value="shadow_api">Shadow APIs</option>
                <option value="prompt_injection">Prompt injection</option>
              </select>

              <button
                onClick={handleScan}
                disabled={loading || !selectedCollection}
                className="mt-2 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {loading ? "Scanning..." : "Run Security Scan"}
              </button>

              {scanStatus === "queued" && (
                <div className="mt-4 p-4 rounded-lg bg-blue-900/30 border border-blue-500/50">
                  <div className="flex items-center gap-2 text-blue-300">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span className="text-sm font-medium">Scan queued — it will begin shortly</span>
                  </div>
                  {queuedScanId && (
                    <p className="text-xs text-blue-400/60 mt-2">Job ID: {queuedScanId}</p>
                  )}
                </div>
              )}

              {scanResult && (
                <div className="mt-6 p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                  <div className="text-sm text-gray-400">Risk score</div>
                  <div className="text-2xl font-bold">
                    {scanResult.riskScore.toFixed(1)}{" "}
                    <span className="text-base text-gray-400">({scanResult.riskLevel})</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Findings ({findings.length})</h2>
              {!scanned ? (
                <EmptyState
                  compact
                  icon={<span>🔍</span>}
                  title="Nothing scanned yet"
                  description="Pick a collection and run a scan to see findings here."
                />
              ) : findings.length === 0 ? (
                <EmptyState
                  compact
                  icon={<span>✅</span>}
                  title="No issues found"
                  description="This collection looks clean. Re-run on each commit via the VS Code extension or CI to keep it that way."
                  actions={[
                    {
                      label: "View collections",
                      href: "/collections",
                      variant: "secondary",
                    },
                  ]}
                />
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {findings.map((f) => (
                    <div
                      key={f.id}
                      className={`p-4 rounded-lg border ${severityColor(f.severity)}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold">{f.title}</span>
                        <span className="text-xs opacity-75 uppercase">{f.severity}</span>
                      </div>
                      {f.description && <p className="text-sm mt-2 opacity-80">{f.description}</p>}
                      {f.remediation && (
                        <p className="text-xs mt-2 text-gray-400">Remediation: {f.remediation}</p>
                      )}
                      {(f.cweId || f.category) && (
                        <p className="text-xs mt-1 text-gray-500">
                          {[f.cweId, f.category].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
