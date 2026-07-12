"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

type ImportSource =
  | "helicone"
  | "portkey"
  | "lakera"
  | "langsmith"
  | "postman"
  | "openapi"
  | "insomnia"
  | "bruno"
  | "csv"
  | "json";

const SOURCES: { value: ImportSource; label: string; description: string }[] = [
  { value: "helicone", label: "Helicone", description: "AI observability platform" },
  { value: "portkey", label: "Portkey", description: "LLM gateway and router" },
  { value: "lakera", label: "Lakera Guard", description: "AI security platform" },
  { value: "langsmith", label: "LangSmith", description: "LangChain observability" },
  { value: "postman", label: "Postman", description: "API platform" },
  { value: "openapi", label: "OpenAPI/Swagger", description: "API specification" },
  { value: "insomnia", label: "Insomnia", description: "API client" },
  { value: "bruno", label: "Bruno", description: "Open-source API client" },
  { value: "csv", label: "Universal CSV", description: "Any tabular data" },
  { value: "json", label: "Universal JSON", description: "Any structured data" },
];

export default function ImportPage() {
  const searchParams = useSearchParams();
  const [source, setSource] = useState<ImportSource | "">("");
  const [data, setData] = useState("");
  const [preview, setPreview] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("source") as ImportSource | null;
    if (s && SOURCES.some((x) => x.value === s)) {
      setSource(s);
    }
  }, [searchParams]);

  const handlePreview = async () => {
    if (!source || !data) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, data: JSON.parse(data) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Preview failed");
      setPreview(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!source || !data) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, data: JSON.parse(data) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Import failed");
      const r = await res.json();
      setResult(`Imported ${r.collections ?? r.endpoints ?? "N/A"} items successfully.`);
      setPreview(null);
      setData("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Import Data</h1>
          <p className="text-gray-400 mt-1">Migrate from another platform to RaksHex</p>
        </div>
        <Link href="/collections" className="text-blue-400 hover:text-blue-300 text-sm">
          ← Back to Collections
        </Link>
      </div>

      {result && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-700/40 rounded-lg">
          <p className="text-green-300">{result}</p>
          <Link href="/collections" className="text-blue-400 text-sm mt-2 inline-block">
            View in Collections →
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700/40 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-black/50/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">1. Select Source</h2>
          <div className="space-y-2">
            {SOURCES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setSource(s.value);
                  setPreview(null);
                  setError(null);
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  source === s.value
                    ? "bg-blue-600/20 border border-blue-500/40 text-blue-200"
                    : "bg-gray-700/50 border border-gray-600/30 text-gray-300 hover:bg-gray-700"
                }`}
              >
                <div className="font-medium">{s.label}</div>
                <div className="text-xs text-gray-400">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-black/50/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">2. Paste Data</h2>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder='{"collections": [...]}'
            className="w-full h-40 bg-transparent border border-gray-700 rounded-lg p-3 text-gray-200 text-sm font-mono resize-none focus:outline-none focus:border-blue-500"
            disabled={!source}
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handlePreview}
              disabled={!source || !data || loading}
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Previewing..." : "Preview"}
            </button>
            <button
              onClick={handleImport}
              disabled={!source || !data || importing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>

      {!!preview && (
        <div className="mt-6 bg-black/50/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Preview</h2>
          <pre className="text-gray-300 text-sm overflow-x-auto">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}

      {!source && !result && (
        <div className="mt-12">
          <EmptyState
            icon="upload"
            title="Select a source to begin"
            description="Import collections, endpoints, and API specs from any supported platform."
          />
        </div>
      )}
    </div>
  );
}
