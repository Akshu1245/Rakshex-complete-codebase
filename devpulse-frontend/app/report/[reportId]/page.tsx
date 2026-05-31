"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, AlertTriangle, AlertCircle, Info, Copy, Check, ArrowRight } from "lucide-react";

interface Finding {
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  endpoint: string;
  description?: string;
  remediation?: string;
}

interface ReportData {
  id: string;
  score: number;
  findings: Finding[];
  filename?: string;
  endpoints?: string[];
  createdAt: string;
  viewCount: number;
}

const severityConfig = {
  Critical: { color: "#EF4444", bg: "rgba(239,68,68,0.15)", icon: AlertTriangle },
  High: { color: "#F97316", bg: "rgba(249,115,22,0.15)", icon: AlertTriangle },
  Medium: { color: "#EAB308", bg: "rgba(234,179,8,0.15)", icon: AlertCircle },
  Low: { color: "#14B8A6", bg: "rgba(20,184,166,0.15)", icon: Info },
};

const remediationTips: Record<string, string> = {
  "Hardcoded API Key":
    "Move the API key to environment variables or a secret manager. Never commit secrets to version control.",
  "Exposed JWT Token":
    "JWTs should be stored in httpOnly cookies or secure storage. Remove from code and URL parameters.",
  "Weak Password Policy":
    "Enforce minimum 12 characters with mixed case, numbers, and symbols. Implement rate limiting on auth endpoints.",
  "Missing Authentication":
    "Add OAuth 2.0, JWT, or API key authentication to all endpoints that expose sensitive data.",
  "Open CORS Policy":
    "Restrict Access-Control-Allow-Origin to specific domains instead of wildcard (*).",
  "SQL Injection Risk":
    "Use parameterized queries or ORM. Never concatenate user input into SQL strings.",
  "Insecure HTTP":
    "Enforce HTTPS with TLS 1.3. Redirect all HTTP traffic to HTTPS and use HSTS headers.",
  "Verbose Error Messages":
    "Return generic error messages to clients. Log detailed errors server-side only.",
  default: "Review OWASP API Security Top 10 guidelines and apply the relevant security controls.",
};

function getScoreColor(score: number) {
  if (score >= 80) return "#14B8A6";
  if (score >= 50) return "#EAB308";
  return "#EF4444";
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Secure";
  if (score >= 50) return "Needs Attention";
  return "Critical Risk";
}

export default function ReportPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(
          `/api/trpc/reports.getById?input=${encodeURIComponent(JSON.stringify({ id: reportId }))}`,
        );
        const json = await res.json();
        if (json.result?.data) {
          setReport(json.result.data);
        } else {
          setError("Report not found");
        }
      } catch {
        setError("Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [reportId]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14B8A6]" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-[#14B8A6]" />
          <h1 className="text-2xl font-bold mb-2">Report Not Found</h1>
          <p className="text-gray-400 mb-6">
            {error || "This scan report does not exist or has expired."}
          </p>
          <Link href="/" className="inline-flex items-center gap-2 text-[#14B8A6] hover:underline">
            <ArrowRight className="w-4 h-4" />
            Scan your own collection
          </Link>
        </div>
      </div>
    );
  }

  const scoreColor = getScoreColor(report.score);
  const scoreLabel = getScoreLabel(report.score);
  const criticalCount = report.findings.filter((f) => f.severity === "Critical").length;
  const highCount = report.findings.filter((f) => f.severity === "High").length;
  const mediumCount = report.findings.filter((f) => f.severity === "Medium").length;
  const lowCount = report.findings.filter((f) => f.severity === "Low").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/icon-mark-128.png" alt="RaksHex" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-[#d4a853]">RaksHex</span>
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Share Report"}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Score Card */}
        <div className="text-center mb-12">
          <div
            className="inline-flex flex-col items-center justify-center w-40 h-40 rounded-full border-4 mb-6"
            style={{ borderColor: scoreColor, background: `${scoreColor}15` }}
          >
            <span className="text-5xl font-bold" style={{ color: scoreColor }}>
              {report.score}
            </span>
            <span className="text-xs uppercase tracking-wider mt-1" style={{ color: scoreColor }}>
              {scoreLabel}
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Security Scan Report</h1>
          <p className="text-gray-400">
            {report.filename && `Scanned: ${report.filename}`}
            {report.endpoints && ` · ${report.endpoints.length} endpoints checked`}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Generated {new Date(report.createdAt).toLocaleDateString()} · {report.viewCount} views
          </p>
        </div>

        {/* Severity Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Critical", count: criticalCount, color: "#EF4444" },
            { label: "High", count: highCount, color: "#F97316" },
            { label: "Medium", count: mediumCount, color: "#EAB308" },
            { label: "Low", count: lowCount, color: "#14B8A6" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#1A1F2E] border border-white/10 rounded-lg p-4 text-center"
            >
              <div className="text-2xl font-bold" style={{ color: s.color }}>
                {s.count}
              </div>
              <div className="text-sm text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Findings List */}
        <div className="space-y-4 mb-12">
          <h2 className="text-xl font-bold mb-4">Findings ({report.findings.length})</h2>
          {report.findings.map((finding, idx) => {
            const config = severityConfig[finding.severity];
            const Icon = config.icon;
            const tip = remediationTips[finding.title] || remediationTips.default;
            return (
              <div
                key={idx}
                className="bg-[#1A1F2E] border border-white/10 rounded-lg p-5 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: config.bg }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{finding.title}</h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: config.bg, color: config.color }}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-1 font-mono">{finding.endpoint}</p>
                    {finding.description && (
                      <p className="text-sm text-gray-300 mb-2">{finding.description}</p>
                    )}
                    <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3 mt-2">
                      <p className="text-sm text-[#14B8A6]">
                        <span className="font-semibold">Fix: </span>
                        {finding.remediation || tip}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#14B8A6]/20 to-[#d4a853]/20 border border-white/10 rounded-xl p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-[#14B8A6]" />
          <h2 className="text-2xl font-bold mb-2">Scan Your Own Collection</h2>
          <p className="text-gray-300 mb-6 max-w-md mx-auto">
            Find security issues in your Postman collections, OpenAPI specs, and API endpoints in
            seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#14B8A6] text-black font-semibold rounded-lg hover:bg-[#0d9488] transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Start Free Scan
            </Link>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
            >
              Install VS Code Extension
            </a>
          </div>
          <div className="mt-4 p-3 bg-black/30 rounded-lg font-mono text-sm text-gray-400 inline-block">
            npx rakshex scan ./collection.json
          </div>
        </div>
      </main>
    </div>
  );
}
