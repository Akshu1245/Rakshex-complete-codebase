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
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      setError("Please upload a JSON file (Postman Collection v2.1)");
      return;
    }
    setFile(file);
    setError(null);
    setResult(null);
  };

  const runScan = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);

    try {
      const text = await file.text();
      const collection = JSON.parse(text);

      // Client-side scan simulation (runs instantly, no backend needed for demo)
      const scanResult = performClientScan(collection);
      setResult(scanResult);
    } catch (err) {
      setError("Invalid JSON file. Please upload a valid Postman Collection.");
    } finally {
      setScanning(false);
    }
  };

  const performClientScan = (collection: any): ScanResult => {
    const findings: Finding[] = [];
    const credentials: CredentialLeak[] = [];
    const endpoints: string[] = [];
    let scanTime = 0;

    const startTime = performance.now();

    // Walk the collection tree
    const walkItems = (items: any[], path: string = "") => {
      items?.forEach((item, idx) => {
        const currentPath = path
          ? `${path} > ${item.name || `Item ${idx}`}`
          : item.name || `Item ${idx}`;

        if (item.request) {
          const req = item.request;
          const url =
            typeof req.url === "string"
              ? req.url
              : req.url?.raw || req.url?.host?.join(".") || "unknown";
          const method = req.method || "GET";
          const endpointId = `${method} ${url}`;
          endpoints.push(endpointId);

          // Check for HTTPS
          if (url.startsWith("http://")) {
            findings.push({
              id: `find-${findings.length}`,
              severity: "High",
              title: "Insecure HTTP endpoint detected",
              endpoint: endpointId,
              category: "OWASP API2:2023 — Broken Authentication",
              remediation: "Change URL to use HTTPS protocol",
              lineNumber: idx,
            });
          }

          // Check headers for security headers
          const headers = req.header || [];
          const headerNames = headers.map((h: any) => (h.key || "").toLowerCase());

          if (!headerNames.includes("authorization") && !headerNames.includes("x-api-key")) {
            findings.push({
              id: `find-${findings.length}`,
              severity: "Medium",
              title: "Missing authentication header",
              endpoint: endpointId,
              category: "OWASP API2:2023 — Broken Authentication",
              remediation: "Add Authorization or X-API-Key header",
              lineNumber: idx,
            });
          }

          // Scan for exposed credentials in headers, body, URL
          const allText = JSON.stringify({ url, headers, body: req.body });
          const secretPatterns = [
            { regex: /sk-[a-zA-Z0-9]{48}/g, type: "OpenAI API Key" },
            { regex: /sk-ant-[a-zA-Z0-9]{32,}/g, type: "Anthropic API Key" },
            { regex: /AIza[0-9A-Za-z_-]{35}/g, type: "Google AI API Key" },
            { regex: /[a-f0-9]{64}/g, type: "Possible Secret Hash" },
            { regex: /Bearer\s+[a-zA-Z0-9._-]{20,}/g, type: "Bearer Token" },
            { regex: /Basic\s+[A-Za-z0-9+/=]{20,}/g, type: "Basic Auth Token" },
            { regex: /password\s*[:=]\s*["'][^"']{4,}["']/gi, type: "Hardcoded Password" },
            { regex: /api[_-]?key\s*[:=]\s*["'][^"']{8,}["']/gi, type: "Hardcoded API Key" },
          ];

          secretPatterns.forEach(({ regex, type }) => {
            const matches = allText.match(regex);
            if (matches) {
              matches.forEach((match) => {
                const preview = match.substring(0, 12) + "..." + match.substring(match.length - 4);
                credentials.push({
                  type,
                  location: currentPath,
                  keyPreview: preview,
                  severity: "Critical",
                });
                findings.push({
                  id: `find-${findings.length}`,
                  severity: "Critical",
                  title: `Exposed ${type} in collection`,
                  endpoint: endpointId,
                  category: "OWASP API3:2023 — Broken Object Property Level Authorization",
                  remediation: `Move ${type} to environment variables or secret manager`,
                  lineNumber: idx,
                });
              });
            }
          });

          // BOLA check — URL with user ID pattern
          if (
            /\{\{userId\}\}|\{userId\}|\/:userId|\/\d+/.test(url) &&
            !headerNames.includes("authorization")
          ) {
            findings.push({
              id: `find-${findings.length}`,
              severity: "Critical",
              title: "Potential BOLA vulnerability — user ID in URL without auth",
              endpoint: endpointId,
              category: "OWASP API1:2023 — Broken Object Level Authorization",
              remediation: "Add authorization checks for user-specific resources",
              lineNumber: idx,
            });
          }
        }

        if (item.item) {
          walkItems(item.item, currentPath);
        }
      });
    };

    walkItems(collection.item || []);

    // Deduplicate findings
    const uniqueFindings = findings.filter(
      (f, i, arr) => arr.findIndex((t) => t.title === f.title && t.endpoint === f.endpoint) === i,
    );

    // Deduplicate credentials
    const uniqueCredentials = credentials.filter(
      (c, i, arr) => arr.findIndex((t) => t.keyPreview === c.keyPreview) === i,
    );

    // Calculate risk score
    const severityWeights = { Critical: 10, High: 7, Medium: 4, Low: 1 };
    const rawRisk = uniqueFindings.reduce((sum, f) => sum + (severityWeights[f.severity] || 0), 0);
    const maxRisk = uniqueFindings.length * 10 || 1;
    const riskScore = Math.min(100, Math.round((rawRisk / maxRisk) * 100));

    // Compliance scores
    const criticalCount = uniqueFindings.filter((f) => f.severity === "Critical").length;
    const highCount = uniqueFindings.filter((f) => f.severity === "High").length;
    const owaspScore = Math.max(0, Math.round(100 - (criticalCount * 15 + highCount * 8)));
    const pciScore = Math.max(0, Math.round(100 - (criticalCount * 20 + highCount * 10)));

    scanTime = performance.now() - startTime;

    return {
      findings: uniqueFindings,
      credentials: uniqueCredentials,
      endpoints: [...new Set(endpoints)],
      riskScore,
      owaspScore,
      pciScore,
      scanTime: Math.round(scanTime),
    };
  };

  const criticalCount = result?.findings.filter((f) => f.severity === "Critical").length || 0;
  const highCount = result?.findings.filter((f) => f.severity === "High").length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Hero Section */}
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

        {/* Upload Zone */}
        <div className="max-w-2xl mx-auto mb-12">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
              dragActive
                ? "border-purple-400 bg-purple-500/10 scale-105"
                : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
            }`}
          >
            <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">
              {file ? file.name : "Drop your Postman Collection JSON here"}
            </p>
            <p className="text-sm text-slate-400 mb-4">
              or click to browse · Supports Postman Collection v2.1
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
              <FileJson className="w-5 h-5" />
              Choose File
            </label>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-400/30 rounded-lg text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {error}
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
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning {file.name}...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Run Security Scan
                </>
              )}
            </button>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Score Cards */}
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
                <p className="text-xs text-slate-500 mt-1">scanned</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <p className="text-sm text-slate-400 mb-1">OWASP Score</p>
                <p
                  className={`text-4xl font-bold ${result.owaspScore >= 80 ? "text-green-400" : result.owaspScore >= 50 ? "text-yellow-400" : "text-red-400"}`}
                >
                  {result.owaspScore}
                </p>
                <p className="text-xs text-slate-500 mt-1">/100 compliance</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <p className="text-sm text-slate-400 mb-1">PCI DSS</p>
                <p
                  className={`text-4xl font-bold ${result.pciScore >= 80 ? "text-green-400" : result.pciScore >= 50 ? "text-yellow-400" : "text-red-400"}`}
                >
                  {result.pciScore}
                </p>
                <p className="text-xs text-slate-500 mt-1">/100 compliance</p>
              </div>
            </div>

            {/* Credential Leaks - THE OH CRAP MOMENT */}
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
                      These have been sitting in your collection. Anyone with access can see them.
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

            {/* Findings List */}
            {result.findings.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-purple-400" />
                  Security Findings ({result.findings.length})
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

            {/* CTA to Sign Up */}
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-400/30 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold mb-3">Want this in your IDE + CI/CD?</h3>
              <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                Get real-time scans as you code, automatic PR checks, cost anomaly alerts, and team
                dashboards — all inside VS Code.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://rakshex.in/signup"
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors"
                >
                  Get Rakshex Free
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex"
                  className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-colors"
                >
                  <FileJson className="w-5 h-5" />
                  VS Code Extension
                </a>
              </div>
              <p className="text-sm text-slate-500 mt-4">
                Free tier: 50 scans/month · No credit card required · Setup in 60 seconds
              </p>
            </div>
          </div>
        )}

        {/* Trust Indicators */}
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
