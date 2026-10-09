"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import type { QuickScanReport } from "./scan-utils";

type Filter = "All" | "Critical" | "High" | "Medium" | "Low";

/**
 * The scanner and YAML parser are lazy-loaded in the browser on click.
 * This page never calls fetch or the public quick-scan API endpoint.
 */
export default function QuickScanPage() {
  const picker = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("pasted-spec.json");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<QuickScanReport | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [dragging, setDragging] = useState(false);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setReport(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("Files must be 5 MiB or smaller. Use the CLI for larger specs.");
      return;
    }
    if (!/\.(json|ya?ml)$/i.test(file.name)) {
      setError("Choose an OpenAPI or Postman JSON, YAML, or YML file.");
      return;
    }
    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
    } catch {
      setError("Unable to read the file locally.");
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void pickFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void pickFile(event.dataTransfer.files?.[0]);
  };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const { scanLocally } = await import("./scan-utils");
      setReport(scanLocally(text, fileName));
      setFilter("All");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to scan the specification.");
    } finally {
      setBusy(false);
    }
  };

  const download = async (format: "json" | "md") => {
    if (!report) return;
    const content =
      format === "json"
        ? JSON.stringify(report, null, 2)
        : (await import("./scan-utils")).reportAsMarkdown(report);
    const blob = new Blob([content], {
      type: format === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rakshex-quick-scan.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const findings =
    report?.findings.filter((finding) => filter === "All" || finding.severity === filter) ?? [];

  return (
    <main className="min-h-screen bg-[#080D14] px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-10 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-wide text-teal-300">
            RaksHex
          </Link>
          <span className="rounded-full border border-teal-700/60 px-3 py-1 text-xs text-teal-200">
            Browser-local · No sign-in
          </span>
        </nav>
        <div className="mb-9 max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">
            Static security analysis
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Quick Scan your API spec
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
            Scan OpenAPI JSON/YAML or a Postman JSON collection for security indicators. Your input
            stays in this browser tab: this page does not upload it to RaksHex. No requests are made
            to your API endpoints.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#101824] p-5 shadow-lg sm:p-7">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed px-5 py-8 text-center ${dragging ? "border-teal-400 bg-teal-400/10" : "border-slate-600 bg-black/10"}`}
          >
            <p className="text-sm font-medium">Drop your .json, .yaml or .yml file here</p>
            <p className="mt-1 text-xs text-slate-500">Maximum file size: 5 MiB · Read locally</p>
            <input
              ref={picker}
              type="file"
              accept=".json,.yaml,.yml,application/json"
              className="sr-only"
              aria-label="Choose API specification file"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={() => picker.current?.click()}
              className="mt-4 rounded-md border border-teal-500 px-4 py-2 text-sm font-medium text-teal-200 hover:bg-teal-950"
            >
              Choose a file
            </button>
          </div>
          <label htmlFor="spec-input" className="mt-6 block text-sm font-medium">
            Or paste your specification
          </label>
          <textarea
            id="spec-input"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setFileName("pasted-spec");
              setReport(null);
            }}
            placeholder={"openapi: 3.0.3\npaths:\n  /orders:\n    post: {}"}
            spellCheck={false}
            className="mt-2 min-h-44 w-full rounded-lg border border-slate-700 bg-[#080D14] p-4 font-mono text-xs leading-relaxed outline-none focus:border-teal-400"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {fileName} · No server required · No AI credits
            </p>
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => void run()}
              className="rounded-lg bg-teal-500 px-6 py-3 font-semibold text-[#041411] hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Scanning locally…" : "Run local scan"}
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-700/60 bg-red-950/20 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}
        </section>

        {report && (
          <section
            className="mt-8 rounded-2xl border border-white/10 bg-[#101824] p-5 sm:p-7"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">
                  Scan complete
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{report.findings.length} finding(s)</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {report.endpointCount} operations · {report.ruleCount} rules · Risk score{" "}
                  {report.riskScore}/100 ({report.riskLevel})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void download("json")}
                  className="rounded-md border border-slate-600 px-3 py-2 text-xs hover:border-teal-400"
                >
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={() => void download("md")}
                  className="rounded-md border border-slate-600 px-3 py-2 text-xs hover:border-teal-400"
                >
                  Download Markdown
                </button>
              </div>
            </div>
            <p className="mt-4 rounded-md border border-slate-700 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
              {report.limitation} A zero-finding result does not prove that an API is secure.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <label htmlFor="severity-filter" className="text-sm text-slate-400">
                Severity
              </label>
              <select
                id="severity-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                className="rounded-md border border-slate-600 bg-[#080D14] p-2 text-sm"
              >
                {(["All", "Critical", "High", "Medium", "Low"] as const).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            {findings.length === 0 ? (
              <p className="mt-6 text-sm text-slate-400">No findings for this filter.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {findings.map((finding, i) => (
                  <li
                    key={`${finding.fingerprint}-${i}`}
                    className="rounded-xl border border-slate-700 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold">
                        {finding.severity}
                      </span>
                      <span className="font-mono text-xs text-slate-400">{finding.ruleId}</span>
                    </div>
                    <h3 className="mt-2 font-medium">{finding.title}</h3>
                    <p className="mt-1 break-words font-mono text-xs text-slate-400">
                      {finding.method} {finding.endpoint}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{finding.description}</p>
                    <p className="mt-3 text-sm text-teal-200">
                      <strong>Suggested fix:</strong> {finding.remediation}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
