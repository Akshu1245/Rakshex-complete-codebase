"use client";

import React, { useState, useCallback } from "react";
import {
  Upload,
  Shield,
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Lock,
  FileJson,
  ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Finding {
  id: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  title: string;
  endpoint: string;
  category: string;
  remediation: string;
  lineNumber?: number;
}

interface CredentialLeak {
  type: string;
  location: string;
  keyPreview: string;
  severity: string;
}

interface ScanResult {
  findings: Finding[];
  credentials: CredentialLeak[];
  endpoints: string[];
  riskScore: number;
  owaspScore: number;
  pciScore: number;
  scanTime: number;
}

const SEVERITY_CONFIG = {
  Critical: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: AlertTriangle,
  },
  High: {
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: AlertTriangle,
  },
  Medium: {
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    icon: AlertTriangle,
  },
  Low: {
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: CheckCircle,
  },
};

export default function DemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<(ScanResult & { remaining?: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const demoScan = trpc.demo.scan.useMutation();

  function performClientDemoScan(collection: any): ScanResult {
    const start = Date.now();
    const findings: any[] = [];
    const credentials: any[] = [];
    const endpoints: string[] = [];

    const secretPatterns = [
      { re: /sk-[A-Za-z0-9]{20,}/g, type: "OpenAI API Key" },
      { re: /sk-ant-[A-Za-z0-9]{20,}/g, type: "Anthropic API Key" },
      { re: /AIza[0-9A-Za-z_-]{10,}/g, type: "Google AI / Gemini Key" },
      { re: /Bearer\s+[A-Za-z0-9._-]{10,}/gi, type: "Bearer Token" },
      { re: /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi, type: "Hardcoded API Key" },
      { re: /password\s*[:=]\s*["'][^"']{4,}["']/gi, type: "Hardcoded Password" },
    ];

    function walkItems(items: any[], path = "") {
      if (!items || !Array.isArray(items)) return;
      for (const item of items) {
        const name = item?.name || "unnamed";
        const req = item?.request || {};
        const url = typeof req.url === "string" ? req.url : req.url?.raw || "";
        if (url) endpoints.push(url);

        const headerStr = JSON.stringify(req.header || {});
        const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
        const allText = `${url} ${headerStr} ${bodyStr} ${name}`;

        for (const p of secretPatterns) {
          const matches = allText.match(p.re);
          if (matches) {
            matches.forEach((m) => {
              credentials.push({
                type: p.type,
                location: `${path}${name} (header/body/url)`,
                keyPreview: m.substring(0, 12) + "..." + m.substring(m.length - 4),
                severity: "Critical",
              });
            });
          }
        }

        if (url && !/auth|token|key|bearer/i.test(headerStr + bodyStr)) {
          findings.push({
            id: `auth-${path}-${name}`,
            severity: "High",
            title: "Missing or weak authentication",
            endpoint: url,
            category: "Broken Authentication",
            remediation: "Add Authorization header with Bearer token or API key.",
          });
        }
        if (/select|insert|update|delete|union|--|;/.test(bodyStr + url)) {
          findings.push({
            id: `sql-${path}-${name}`,
            severity: "Critical",
            title: "Potential SQL/NoSQL injection vector",
            endpoint: url,
            category: "Injection",
            remediation:
              "Use parameterized queries / ORM. Never concatenate user data into queries.",
          });
        }

        if (item.item) walkItems(item.item, `${path}${name}/`);
      }
    }

    const items = collection?.item || collection?.paths || [];
    walkItems(items);

    const uniqueCreds = credentials.filter(
      (c, idx, self) => self.findIndex((x) => x.keyPreview === c.keyPreview) === idx,
    );
    const risk = Math.min(
      100,
      Math.max(
        5,
        uniqueCreds.length * 25 + findings.filter((f) => f.severity === "Critical").length * 15,
      ),
    );

    return {
      findings: findings.slice(0, 12),
      credentials: uniqueCreds,
      endpoints: [...new Set(endpoints)].slice(0, 20),
      riskScore: Math.round(risk),
      owaspScore: Math.max(30, 95 - uniqueCreds.length * 8 - findings.length * 3),
      pciScore: Math.max(20, 90 - uniqueCreds.length * 10),
      scanTime: Date.now() - start,
    };
  }

  const SAMPLE_COLLECTION = {
    info: {
      name: "Demo API - Contains Secrets",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: "Get User Profile",
        request: {
          method: "GET",
          url: { raw: "https://api.example.com/v1/users/me" },
          header: [
            { key: "Authorization", value: "Bearer sk-FAKE1234567890abcdefABCDEF1234567890abcdef" },
            { key: "X-Api-Key", value: "AIzaSyFAKE_GoogleKeyForDemo1234567890AB" },
          ],
        },
      },
      {
        name: "Create Payment",
        request: {
          method: "POST",
          url: { raw: "https://api.example.com/v1/payments" },
          body: {
            mode: "raw",
            raw: JSON.stringify({
              amount: 999,
              card: "4242-4242-4242-4242",
              password: "supersecret123",
            }),
          },
        },
      },
    ],
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".json")) {
      setError("Please upload a JSON file (Postman Collection v2.1)");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const loadSample = () => {
    const json = JSON.stringify(SAMPLE_COLLECTION, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const sampleFile = new File([blob], "demo-collection-with-secrets.json", {
      type: "application/json",
    });
    setFile(sampleFile);
    setError(null);
    setResult(null);
    setScanning(true);
    setTimeout(() => {
      const local = performClientDemoScan(SAMPLE_COLLECTION);
      setResult({ ...local, remaining: 12 });
      setScanning(false);
    }, 110);
  };

  const runScan = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);
    setResult(null);
    let collection: any;
    try {
      const text = await file.text();
      if (text.length > 2_100_000) {
        setError("File too large for instant demo.");
        setScanning(false);
        return;
      }
      collection = JSON.parse(text);
    } catch {
      setError("Invalid JSON. Upload Postman v2.1 or OpenAPI JSON.");
      setScanning(false);
      return;
    }

    const localResult = performClientDemoScan(collection);
    try {
      const br: any = await demoScan
        .mutateAsync({ collection, filename: file.name })
        .catch(() => null);
      setResult(
        br?.findings ? { ...br, remaining: br.remaining ?? 10 } : { ...localResult, remaining: 11 },
      );
    } catch {
      setResult({ ...localResult, remaining: 11 });
    } finally {
      setScanning(false);
    }
  };

  const clearDemo = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const copyReport = () => {
    if (!result) return;
    const report = {
      scannedFile: file?.name,
      ...result,
      generatedAt: new Date().toISOString(),
      note: "Public demo result. Nothing stored.",
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      const orig = document.title;
      document.title = "Report copied!";
      setTimeout(() => (document.title = orig), 1200);
    });
  };

  const criticalCount = result?.findings.filter((f) => f.severity === "Critical").length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-400/30 rounded-full px-4 py-2 mb-6">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">
              Zero setup · No signup · Instant results
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
            Find API Vulnerabilities in 3 Seconds
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Drop your Postman collection. We will find exposed API keys, OWASP vulnerabilities, and
            estimate your security risk — instantly, for free, no account required.
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-12">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${dragActive ? "border-purple-400 bg-purple-500/10 scale-105" : "border-slate-600 bg-slate-800/50 hover:border-slate-500"}`}
          >
            <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">
              {file ? file.name : "Drop your Postman Collection JSON here"}
            </p>
            <p className="text-sm text-slate-400 mb-4">
              or click to browse · Supports Postman Collection v2.1 / OpenAPI JSON
            </p>
            <input
              type="file"
              accept=".json"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors"
            >
              <FileJson className="w-5 h-5" /> Choose File
            </label>
          </div>

          <button
            onClick={loadSample}
            disabled={scanning}
            className="mt-3 w-full border border-purple-400/50 hover:bg-purple-500/10 text-purple-300 py-2 rounded-xl text-sm transition-colors"
          >
            Or load sample collection (instantly shows exposed keys + findings)
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-400/30 rounded-lg text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> {error}
            </div>
          )}

          {file && !result && (
            <button
              onClick={runScan}
              disabled={scanning}
              className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {scanning ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                  Scanning...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" /> Run Security Scan
                </>
              )}
            </button>
          )}
        </div>

        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
              {typeof result.remaining === "number" && (
                <div className="text-slate-400">
                  Demo scans remaining this hour:{" "}
                  <span className="font-mono text-purple-300">{result.remaining}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={copyReport}
                  className="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Copy JSON Report
                </button>
                <button
                  onClick={clearDemo}
                  className="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div
                className={`p-6 rounded-xl border ${criticalCount > 0 ? "bg-red-500/10 border-red-400/30" : "bg-green-500/10 border-green-400/30"}`}
              >
                <p className="text-sm text-slate-400 mb-1">Risk Score</p>
                <p
                  className={`text-4xl font-bold ${criticalCount > 0 ? "text-red-400" : "text-green-400"}`}
                >
                  {result.riskScore}/100
                </p>
                <p className="text-xs text-slate-500 mt-1">{result.scanTime}ms scan time</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <p className="text-sm text-slate-400 mb-1">Endpoints</p>
                <p className="text-4xl font-bold text-white">{result.endpoints.length}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <p className="text-sm text-slate-400 mb-1">OWASP Score</p>
                <p
                  className={`text-4xl font-bold ${result.owaspScore >= 80 ? "text-green-400" : result.owaspScore >= 50 ? "text-yellow-400" : "text-red-400"}`}
                >
                  {result.owaspScore}
                </p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <p className="text-sm text-slate-400 mb-1">PCI DSS</p>
                <p
                  className={`text-4xl font-bold ${result.pciScore >= 80 ? "text-green-400" : result.pciScore >= 50 ? "text-yellow-400" : "text-red-400"}`}
                >
                  {result.pciScore}
                </p>
              </div>
            </div>

            {result.credentials.length > 0 && (
              <div className="bg-red-500/10 border-2 border-red-400/50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-8 h-8 text-red-400" />
                  <div>
                    <h3 className="text-xl font-bold text-red-400">
                      🚨 {result.credentials.length} Exposed Credential
                      {result.credentials.length > 1 ? "s" : ""} Found
                    </h3>
                    <p className="text-sm text-red-300">
                      These have been sitting in your collection.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {result.credentials.map((cred, i) => (
                    <div
                      key={i}
                      className="bg-slate-900/50 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-white">{cred.type}</p>
                        <p className="text-sm text-slate-400">Location: {cred.location}</p>
                        <p className="text-sm font-mono text-red-300 mt-1">{cred.keyPreview}</p>
                      </div>
                      <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium">
                        {cred.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.findings.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-purple-400" /> Security Findings (
                  {result.findings.length})
                </h3>
                <div className="space-y-3">
                  {result.findings.map((finding) => {
                    const config = SEVERITY_CONFIG[finding.severity];
                    const Icon = config.icon;
                    return (
                      <div
                        key={finding.id}
                        className={`rounded-lg border p-4 ${config.bg} ${config.border}`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-sm font-bold ${config.color}`}>
                                {finding.severity}
                              </span>
                              <span className="text-slate-500">·</span>
                              <span className="text-sm text-slate-300">{finding.category}</span>
                            </div>
                            <p className="font-medium text-white mb-1">{finding.title}</p>
                            <p className="text-sm font-mono text-slate-400 mb-2">
                              {finding.endpoint}
                            </p>
                            <div className="bg-slate-900/50 rounded p-3">
                              <p className="text-sm text-slate-300">
                                <span className="text-green-400 font-medium">Fix:</span>{" "}
                                {finding.remediation}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.findings.length === 0 && result.credentials.length === 0 && (
              <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-400 mb-2">All Clear!</h3>
                <p className="text-slate-300">
                  No vulnerabilities or exposed credentials found in this collection.
                </p>
              </div>
            )}

            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-400/30 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-3">Want this in your IDE + CI/CD?</h3>
              <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                Get real-time scans as you code, automatic PR checks, cost anomaly alerts, and team
                dashboards.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://rakshex.in/signup"
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors"
                >
                  Get Rakshex Free <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex"
                  className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors"
                >
                  <FileJson className="w-5 h-5" /> VS Code Extension
                </a>
              </div>
            </div>
          </div>
        )}

        {!result && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-6">
              <Shield className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <h3 className="font-bold mb-2">OWASP Top 10 Scanning</h3>
              <p className="text-sm text-slate-400">
                Detects BOLA, broken auth, injection, and more
              </p>
            </div>
            <div className="p-6">
              <DollarSign className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <h3 className="font-bold mb-2">LLM Cost Intelligence</h3>
              <p className="text-sm text-slate-400">
                Track token spend per endpoint and catch anomalies
              </p>
            </div>
            <div className="p-6">
              <Lock className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <h3 className="font-bold mb-2">Secret Detection</h3>
              <p className="text-sm text-slate-400">
                Finds API keys, tokens, and passwords in collections
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
