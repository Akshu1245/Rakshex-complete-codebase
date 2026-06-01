"use client";
import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { trpc } from "@/lib/trpc";

type CollectionFormat = "postman" | "openapi";

interface CredentialFinding {
  ruleId: string;
  description: string;
  severity: string;
  path: string;
  matchPreview: string;
  line?: number;
}

interface GatewayFinding {
  endpoint: string;
  method: string;
  category: string;
  severity: string;
  description: string;
  remediation: string;
  sample: string;
}

interface ImportResult {
  id: string;
  name: string;
  format: string;
  credentialFindings?: CredentialFinding[];
  gatewayFindings?: GatewayFinding[];
}

type ImportStage = "idle" | "parsing" | "scanning" | "persisting" | "done";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]",
  high: "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]",
  medium: "bg-[#FDB022]/15 border-[#FDB022]/30 text-[#FDB022]",
  low: "bg-[#3B82F6]/15 border-[#3B82F6]/30 text-[#3B82F6]",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CollectionsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading: isListLoading } = trpc.collections.list.useQuery();
  const collections = data?.collections ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFormat, setUploadFormat] = useState<CollectionFormat>("postman");
  const [uploadData, setUploadData] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Batch import state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);
  const [credentialFindings, setCredentialFindings] = useState<CredentialFinding[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const createCollection = trpc.collections.create.useMutation();

  const resetImport = () => {
    setBatchFiles([]);
    setImportStage("idle");
    setImportResults([]);
    setCurrentImportIndex(0);
    setCredentialFindings([]);
    setError(null);
    setUploadData("");
    setUploadName("");
  };

  const parseFile = (
    file: File,
  ): Promise<{ format: CollectionFormat; data: unknown; name: string }> => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const format: CollectionFormat = ext === "yaml" || ext === "yml" ? "openapi" : "postman";
      const baseName = file.name.replace(/\.[^.]+$/g, "");

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        try {
          if (format === "openapi" && (ext === "yaml" || ext === "yml")) {
            resolve({ format, data: { _rawYaml: text }, name: baseName });
          } else {
            const parsed = JSON.parse(text);
            // Auto-detect Postman vs OpenAPI in JSON
            let detectedFormat = format;
            if (parsed.openapi || parsed.swagger) detectedFormat = "openapi";
            else if (parsed.info?._postman_id || parsed.item) detectedFormat = "postman";
            resolve({ format: detectedFormat, data: parsed, name: baseName });
          }
        } catch {
          reject(
            new Error(
              `Failed to parse ${file.name} — invalid ${format === "openapi" ? "YAML/JSON" : "JSON"}`,
            ),
          );
        }
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });
  };

  const handleBatchImport = async () => {
    if (batchFiles.length === 0) return;
    setError(null);
    setImportStage("parsing");

    const results: ImportResult[] = [];
    let allFindings: CredentialFinding[] = [];

    try {
      // Stage 1: Parse all files
      const parsed = [];
      for (let i = 0; i < batchFiles.length; i++) {
        setCurrentImportIndex(i);
        try {
          const p = await parseFile(batchFiles[i]);
          parsed.push(p);
        } catch (err) {
          setError((err as Error).message);
          setImportStage("idle");
          return;
        }
      }

      // Stage 2: Scan + persist each collection
      setImportStage("scanning");
      for (let i = 0; i < parsed.length; i++) {
        setCurrentImportIndex(i);
        const p = parsed[i];

        try {
          const result = await createCollection.mutateAsync({
            name: p.name || `Imported ${batchFiles[i].name}`,
            format: p.format,
            data: p.data as Record<string, any>,
          });

          const credFindings =
            (
              result as {
                credentialFindings?: CredentialFinding[];
                gatewayFindings?: GatewayFinding[];
              }
            ).credentialFindings ?? [];
          const gwFindings =
            (result as { gatewayFindings?: GatewayFinding[] }).gatewayFindings ?? [];
          results.push({
            id: (result as { id: string }).id,
            name: p.name || batchFiles[i].name,
            format: p.format,
            credentialFindings: credFindings,
            gatewayFindings: gwFindings,
          });
          allFindings = [
            ...allFindings,
            ...credFindings.map((f) => ({ ...f, path: `${p.name}/${f.path}` })),
          ];
        } catch (err) {
          results.push({
            id: "error",
            name: p.name || batchFiles[i].name,
            format: p.format,
          });
          setError(`Failed to import ${batchFiles[i].name}: ${(err as Error).message}`);
        }
      }

      setImportResults(results);
      setCredentialFindings(allFindings);
      setImportStage("done");
      utils.collections.list.invalidate();
    } catch (err) {
      setError((err as Error).message);
      setImportStage("idle");
    }
  };

  const handleSingleImport = () => {
    if (!uploadName.trim() || !uploadData.trim()) return;
    setError(null);
    setImportStage("persisting");

    let parsed: unknown;
    try {
      parsed = JSON.parse(uploadData);
    } catch {
      setError("Collection data must be valid JSON.");
      setImportStage("idle");
      return;
    }

    createCollection.mutate(
      { name: uploadName, format: uploadFormat, data: parsed as Record<string, any> },
      {
        onSuccess: (result) => {
          const credFindings =
            (result as { credentialFindings?: CredentialFinding[] }).credentialFindings ?? [];
          setImportResults([
            {
              id: (result as { id: string }).id,
              name: uploadName,
              format: uploadFormat,
              credentialFindings: credFindings,
            },
          ]);
          setCredentialFindings(credFindings);
          setImportStage("done");
          utils.collections.list.invalidate();
        },
        onError: (err: { message: string }) => {
          setError(err.message);
          setImportStage("idle");
        },
      },
    );
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(
      (f) => /\.(json|yaml|yml)$/i.test(f.name) || f.name.includes("postman"),
    );
    if (fileArr.length === 0) {
      setError("Please select .json, .yaml, or .yml files.");
      return;
    }
    setBatchFiles(fileArr);
    if (fileArr.length === 1 && !uploadName.trim()) {
      setUploadName(fileArr[0].name.replace(/\.[^.]+$/g, ""));
      const ext = fileArr[0].name.split(".").pop()?.toLowerCase();
      if (ext === "yaml" || ext === "yml") setUploadFormat("openapi");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;
    const del = trpc.collections.delete.useMutation({
      onSuccess: () => {
        utils.collections.list.invalidate();
        setDeleteConfirm(null);
      },
      onError: (err: { message: string }) => setError(err.message),
    });
    del.mutate({ id: deleteConfirm });
  };

  const stageLabels: Record<ImportStage, string> = {
    idle: "",
    parsing: "Parsing files…",
    scanning: `Scanning for credentials & vulnerabilities (${currentImportIndex + 1}/${batchFiles.length})`,
    persisting: "Importing collection…",
    done: "Import complete",
  };

  const stageProgress: Record<ImportStage, number> = {
    idle: 0,
    parsing: 15,
    scanning: 60,
    persisting: 80,
    done: 100,
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#06D6A0]">Collections</h1>
            <p className="text-gray-400 mt-1">Manage your API collections</p>
          </div>
          <Link href="/dashboard" className="text-[#06D6A0] hover:text-[#00F0FF] transition-colors">
            ← Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-[#EF4444] hover:text-[#EF4444]/80"
            >
              ✕
            </button>
          </div>
        )}

        {/* Import progress bar */}
        {importStage !== "idle" && (
          <div className="bg-black/50 p-4 rounded-lg border border-[#2D3E50] mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">{stageLabels[importStage]}</span>
              <span className="text-sm text-gray-500">{stageProgress[importStage]}%</span>
            </div>
            <div className="w-full bg-transparent rounded-full h-2">
              <div
                className="bg-[#06D6A0] h-2 rounded-full transition-all duration-500"
                style={{ width: `${stageProgress[importStage]}%` }}
              />
            </div>
            {batchFiles.length > 0 && importStage !== "done" && (
              <div className="mt-3 space-y-1">
                {batchFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                    <span
                      className={
                        i < currentImportIndex
                          ? "text-[#10B981]"
                          : i === currentImportIndex
                            ? "text-[#06D6A0]"
                            : ""
                      }
                    >
                      {i < currentImportIndex ? "✓" : i === currentImportIndex ? "⟳" : "○"}
                    </span>
                    <span>{f.name}</span>
                    <span className="text-gray-600">({formatBytes(f.size)})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Credential findings display */}
        {credentialFindings.length > 0 && importStage === "done" && (
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-4 mb-6">
            <h3 className="text-[#EF4444] font-semibold mb-2 flex items-center gap-2">
              <span>🔑</span>
              {credentialFindings.length} potential credential
              {credentialFindings.length !== 1 ? "s" : ""} detected
            </h3>
            <p className="text-[#EF4444]/70 text-xs mb-3">
              Credentials found in your imported collection. Review and rotate these immediately.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {credentialFindings.map((f, i) => (
                <div
                  key={i}
                  className={`p-2 rounded border text-xs ${SEVERITY_COLORS[f.severity?.toLowerCase()] || SEVERITY_COLORS.medium}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs opacity-80">{f.ruleId}</span>
                    <span className="uppercase font-semibold">{f.severity}</span>
                  </div>
                  <p className="mt-1 opacity-90">{f.description}</p>
                  <div className="mt-1 flex gap-2 text-xs opacity-60">
                    <span className="font-mono truncate max-w-xs">{f.path}</span>
                    {f.matchPreview && (
                      <span className="font-mono text-[#EF4444]/80">→ {f.matchPreview}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gateway scan findings (prompt injection, PII, insecure auth) */}
        {importResults.some((r) => (r.gatewayFindings?.length ?? 0) > 0) &&
          importStage === "done" && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-4 mb-6">
              <h3 className="text-[#F59E0B] font-semibold mb-2 flex items-center gap-2">
                <span>🛡</span>
                LLM Gateway issues detected
              </h3>
              <p className="text-[#F59E0B]/70 text-xs mb-3">
                Your API endpoints have issues that could be exploited through LLM-based attacks.
                Review and add protections.
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {importResults.flatMap((r) =>
                  (r.gatewayFindings ?? []).map((f, i) => (
                    <div
                      key={`${r.id}-${i}`}
                      className={`p-3 rounded border text-xs ${
                        f.severity === "Critical"
                          ? "bg-[#EF4444]/15 border-[#EF4444]/30 text-[#EF4444]"
                          : f.severity === "High"
                            ? "bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B]"
                            : f.severity === "Medium"
                              ? "bg-[#FDB022]/15 border-[#FDB022]/30 text-[#FDB022]"
                              : "bg-[#3B82F6]/15 border-[#3B82F6]/30 text-[#3B82F6]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs uppercase bg-black/50 px-1.5 py-0.5 rounded">
                            {f.method}
                          </span>
                          <span className="font-mono text-xs truncate max-w-xs">{f.endpoint}</span>
                        </div>
                        <span className="uppercase font-semibold text-xs">{f.severity}</span>
                      </div>
                      <p className="mt-1">{f.description}</p>
                      <div className="mt-2 flex items-start gap-2">
                        <span className="shrink-0 text-[#10B981] text-xs">Fix:</span>
                        <span className="text-gray-400 text-xs">{f.remediation}</span>
                      </div>
                    </div>
                  )),
                )}
              </div>
            </div>
          )}

        {/* Import results summary */}
        {importResults.length > 0 && importStage === "done" && (
          <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-4 mb-6">
            <h3 className="text-[#10B981] font-semibold flex items-center gap-2">
              <span>✓</span>
              {importResults.filter((r) => r.id !== "error").length} collection
              {importResults.length !== 1 ? "s" : ""} imported
            </h3>
            <div className="mt-2 space-y-1">
              {importResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={r.id === "error" ? "text-[#EF4444]" : "text-[#10B981]"}>
                    {r.id === "error" ? "✕" : "✓"}
                  </span>
                  <span className="text-gray-300">{r.name}</span>
                  <span className="text-gray-500 text-xs">({r.format})</span>
                  {r.credentialFindings && r.credentialFindings.length > 0 && (
                    <span className="text-[#EF4444] text-xs">🔑 {r.credentialFindings.length}</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={resetImport}
              className="mt-3 text-sm text-[#06D6A0] hover:text-[#00F0FF] transition-colors"
            >
              Import more collections →
            </button>
          </div>
        )}

        <div className="flex justify-end mb-6">
          <div className="flex gap-4 items-center">
            <button
              onClick={() => {
                setShowUpload(true);
                resetImport();
              }}
              className="px-4 py-2 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] hover:opacity-90 rounded-lg font-semibold transition-all"
            >
              Import Collection
            </button>
          </div>
        </div>

        {showUpload && importStage === "idle" && (
          <div className="bg-black/50 p-6 rounded-lg border border-[#2D3E50] mb-8">
            <h2 className="text-xl font-semibold mb-4">Import Collection</h2>

            {/* Drag-and-drop zone */}
            <div
              ref={dropZoneRef}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-[#06D6A0] bg-[#06D6A0]/10"
                  : batchFiles.length > 0
                    ? "border-[#10B981]/50 bg-[#10B981]/10"
                    : "border-[#2D3E50] hover:border-[#06D6A0]"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.yaml,.yml"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
              />
              {batchFiles.length > 0 ? (
                <div>
                  <svg
                    className="w-10 h-10 mx-auto mb-3 text-[#10B981]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <p className="text-[#10B981] font-semibold">
                    {batchFiles.length} file{batchFiles.length !== 1 ? "s" : ""} selected
                  </p>
                  <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                    {batchFiles.map((f, i) => (
                      <div
                        key={i}
                        className="text-sm text-gray-400 flex items-center justify-center gap-2"
                      >
                        <span>{f.name}</span>
                        <span className="text-gray-600">({formatBytes(f.size)})</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBatchFiles((prev) => prev.filter((_, j) => j !== i));
                          }}
                          className="text-[#EF4444] hover:text-[#EF4444]/80 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click or drop to replace files</p>
                </div>
              ) : (
                <div>
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-gray-300 font-medium">
                    Drop Postman collections or OpenAPI specs here
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    .json, .yaml, .yml — drag multiple files for batch import
                  </p>
                </div>
              )}
            </div>

            {batchFiles.length > 0 && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleBatchImport}
                  disabled={createCollection.isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] hover:opacity-90 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {createCollection.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0A0E1A]"></div>
                      Importing…
                    </>
                  ) : (
                    `Import ${batchFiles.length} file${batchFiles.length !== 1 ? "s" : ""}`
                  )}
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 text-gray-500 text-sm my-4">
              <div className="flex-1 border-t border-[#2D3E50]"></div>
              <span>or paste manually</span>
              <div className="flex-1 border-t border-[#2D3E50]"></div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="collection-name" className="block text-sm text-gray-400 mb-1">
                  Collection Name
                </label>
                <input
                  id="collection-name"
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="My API Collection"
                  className="w-full px-4 py-2 rounded-lg bg-transparent border border-[#2D3E50] focus:ring-2 focus:ring-[#06D6A0] focus:border-[#06D6A0] outline-none"
                />
              </div>
              <div>
                <label htmlFor="collection-format" className="block text-sm text-gray-400 mb-1">
                  Format
                </label>
                <select
                  id="collection-format"
                  value={uploadFormat}
                  onChange={(e) => setUploadFormat(e.target.value as CollectionFormat)}
                  className="w-full px-4 py-2 rounded-lg bg-transparent border border-[#2D3E50] focus:ring-2 focus:ring-[#06D6A0] focus:border-[#06D6A0] outline-none"
                >
                  <option value="postman">Postman (auto-detect)</option>
                  <option value="openapi">OpenAPI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Collection Data (JSON)</label>
                <textarea
                  value={uploadData}
                  onChange={(e) => setUploadData(e.target.value)}
                  placeholder='{"info": {"name": "My API", "_postman_id": "..."}}'
                  className="w-full h-40 px-4 py-2 rounded-lg bg-transparent border border-[#2D3E50] focus:ring-2 focus:ring-[#06D6A0] focus:border-[#06D6A0] outline-none font-mono text-sm"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleSingleImport}
                  disabled={createCollection.isPending || !uploadData.trim() || !uploadName.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] hover:opacity-90 rounded-lg font-semibold transition-all disabled:opacity-50"
                >
                  {createCollection.isPending ? "Importing…" : "Import"}
                </button>
                <button
                  onClick={() => {
                    setShowUpload(false);
                    resetImport();
                  }}
                  className="px-4 py-2 bg-transparent border border-[#2D3E50] hover:bg-black/50 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Collection list */}
        <div className="space-y-4">
          {isListLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#06D6A0]"></div>
            </div>
          ) : collections.length === 0 ? (
            <EmptyState
              icon={<span>📚</span>}
              title="No collections yet"
              description="Import a Postman or OpenAPI collection to start scanning your APIs for security issues and shadow endpoints. Or migrate from a competitor."
              actions={[
                {
                  label: "Import Collection",
                  onClick: () => {
                    setShowUpload(true);
                    resetImport();
                  },
                },
                {
                  label: "Import from Helicone",
                  href: "/import?source=helicone",
                  variant: "secondary" as const,
                },
                {
                  label: "Import from Portkey",
                  href: "/import?source=portkey",
                  variant: "secondary" as const,
                },
                { label: "View documentation", href: "/onboarding", variant: "secondary" as const },
              ]}
            />
          ) : (
            collections.map((col) => (
              <div
                key={col.id}
                className="bg-black/50 p-6 rounded-lg border border-[#2D3E50] flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-semibold">{col.name}</h3>
                  <p className="text-gray-400 text-sm">{col.description || "No description"}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="uppercase">{col.format}</span>
                    <span>{col.totalRequests} requests</span>
                    <span>{new Date(col.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/scanning?collection=${col.id}`}
                    className="px-4 py-2 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] hover:opacity-90 rounded-lg font-semibold transition-all text-sm"
                  >
                    Scan
                  </Link>
                  <button
                    onClick={() => setDeleteConfirm(col.id)}
                    className="px-4 py-2 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Collection?"
        message="This will permanently delete the collection and all its associated scan data. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
