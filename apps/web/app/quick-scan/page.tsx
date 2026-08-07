"use client";

import { useState } from "react";
import Link from "next/link";

type QuickScanFinding = {
  title: string;
  severity?: string;
  category?: string;
  endpoint?: string;
  method?: string;
};

type QuickScanResult = {
  riskScore: number;
  riskLevel?: string;
  totalFindings?: number;
  exposedCredentials?: number;
  findings: QuickScanFinding[];
  truncated?: boolean;
  message?: string;
  error?: string;
};

export default function QuickScanPage() {
  const [mode, setMode] = useState<"json" | "url">("json");
  const [specText, setSpecText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickScanResult | null>(null);

  const runScan = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let body: { spec?: unknown; url?: string };
      if (mode === "url") {
        if (!url.trim()) {
          setError("Enter a URL to a Postman or OpenAPI JSON spec.");
          setLoading(false);
          return;
        }
        body = { url: url.trim() };
      } else {
        if (!specText.trim()) {
          setError("Paste a Postman or OpenAPI JSON spec.");
          setLoading(false);
          return;
        }
        try {
          body = { spec: JSON.parse(specText) };
        } catch {
          setError("Spec must be valid JSON.");
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/public/quick-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as QuickScanResult | null;
      if (!res.ok || !data) {
        setError(data?.error || `Scan failed (HTTP ${res.status})`);
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-sm text-blue-400 mb-2">
            <Link href="/" className="hover:text-blue-300">
              RaksHex
            </Link>
          </p>
          <h1 className="text-3xl font-bold text-blue-400">Quick Scan</h1>
          <p className="text-gray-400 mt-2">
            Paste a Postman/OpenAPI collection or provide a URL. Static analysis only — no account
            required for a capped preview.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("json")}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              mode === "json"
                ? "border-blue-500 bg-blue-600/30 text-blue-200"
                : "border-gray-600 text-gray-400"
            }`}
          >
            Paste JSON
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-3 py-1.5 rounded-md text-sm border ${
              mode === "url"
                ? "border-blue-500 bg-blue-600/30 text-blue-200"
                : "border-gray-600 text-gray-400"
            }`}
          >
            Spec URL
          </button>
        </div>

        {mode === "json" ? (
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            placeholder='{"info":{"name":"My API"},"item":[...]}'
            className="w-full min-h-[220px] px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 font-mono text-sm text-gray-100 focus:ring-2 focus:ring-teal-500 outline-none"
          />
        ) : (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/openapi.json"
            className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
        )}

        <button
          type="button"
          onClick={runScan}
          disabled={loading}
          className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium"
        >
          {loading ? "Scanning…" : "Run quick scan"}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-8 space-y-4 border border-gray-700 rounded-lg p-6 bg-black/40">
            <div className="flex flex-wrap gap-4 items-baseline">
              <h2 className="text-xl font-semibold text-white">Results</h2>
              <span className="text-blue-300">
                Risk score: <strong>{result.riskScore}</strong>
                {result.riskLevel ? ` (${result.riskLevel})` : ""}
              </span>
              {typeof result.totalFindings === "number" && (
                <span className="text-gray-400 text-sm">
                  {result.totalFindings} finding{result.totalFindings === 1 ? "" : "s"}
                  {typeof result.exposedCredentials === "number"
                    ? ` · ${result.exposedCredentials} credential hit(s)`
                    : ""}
                </span>
              )}
            </div>

            {result.findings?.length ? (
              <ul className="space-y-2">
                {result.findings.map((f, i) => (
                  <li
                    key={`${f.title}-${i}`}
                    className="text-sm border border-gray-800 rounded-md px-3 py-2"
                  >
                    <span className="text-amber-300/90 uppercase text-xs mr-2">
                      {f.severity || "info"}
                    </span>
                    <span className="text-white">{f.title}</span>
                    {(f.method || f.endpoint) && (
                      <span className="block text-gray-500 mt-1 font-mono text-xs">
                        {[f.method, f.endpoint].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No findings in the free preview set.</p>
            )}

            {result.message && <p className="text-sm text-gray-400">{result.message}</p>}

            <Link
              href="/login?redirect=/dashboard"
              className="inline-block text-sm text-blue-400 hover:text-blue-300"
            >
              Create a free account for the full report →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
