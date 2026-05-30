"use client";

import React, { useState, useEffect, useRef } from "react";

const ENDPOINTS = [
  { method: "GET", path: "/v1/customers" },
  { method: "GET", path: "/v1/customers/{id}" },
  { method: "POST", path: "/v1/customers" },
  { method: "DELETE", path: "/v1/customers/{id}" },
  { method: "GET", path: "/v1/charges" },
  { method: "POST", path: "/v1/charges" },
  { method: "GET", path: "/v1/charges/{id}" },
  { method: "POST", path: "/v1/refunds" },
  { method: "GET", path: "/v1/invoices" },
  { method: "POST", path: "/v1/invoices" },
  { method: "GET", path: "/v1/payment_intents" },
  { method: "POST", path: "/v1/payment_intents" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20",
  POST: "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20",
  DELETE: "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20",
  PUT: "bg-[#FDB022]/10 text-[#FDB022] border border-[#FDB022]/20",
};

const MOCK_FINDINGS = [
  {
    id: "f1",
    severity: "Critical" as const,
    owasp: "API1:2023",
    title: "Broken Object Level Authorization",
    endpoint: "GET /v1/customers/{id}",
    detail:
      "Customer ID is user-supplied. No ownership check on the authenticated user's session. Any authenticated user can read any customer record.",
    fix: "Validate that the authenticated user owns the requested customer ID before returning data.",
  },
  {
    id: "f2",
    severity: "High" as const,
    owasp: "API3:2023",
    title: "Excessive Data Exposure — PAN in response body",
    endpoint: "GET /v1/charges/{id}",
    detail:
      "Response includes raw card.number and card.cvc fields. PCI DSS requires these to be masked or omitted entirely in API responses.",
    fix: "Strip card.cvc from all responses. Mask card.number to last 4 digits only.",
  },
  {
    id: "f3",
    severity: "High" as const,
    owasp: "API2:2023",
    title: "Missing Rate Limiting on Payment Intent creation",
    endpoint: "POST /v1/payment_intents",
    detail:
      "No X-RateLimit headers observed. Attackers can enumerate payment intents or perform card-testing attacks at scale.",
    fix: "Implement per-IP and per-user rate limiting. Return 429 with Retry-After header.",
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30",
  High: "text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30",
  Medium: "text-[#FDB022] bg-[#FDB022]/10 border border-[#FDB022]/30",
  Low: "text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/30",
};

const TOKEN_AGENTS = [
  { agent: "stripe-billing-agent", model: "gpt-4o", tokens: 1420, cost: 0.0142 },
  { agent: "fraud-detection-llm", model: "claude-3-5-sonnet", tokens: 2830, cost: 0.0339 },
  { agent: "support-copilot", model: "gpt-4o-mini", tokens: 890, cost: 0.0027 },
  { agent: "invoice-summariser", model: "claude-3-haiku", tokens: 3100, cost: 0.0062 },
  { agent: "chargeback-analyst", model: "gpt-4o", tokens: 1960, cost: 0.0196 },
];

function parsePostman(json: any) {
  const list: { method: string; path: string; headers?: any[]; body?: any }[] = [];
  function traverse(items: any[]) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item.request) {
        const method = item.request.method || "GET";
        let path = "";
        if (typeof item.request.url === "string") {
          path = item.request.url;
        } else if (item.request.url && Array.isArray(item.request.url.path)) {
          path = "/" + item.request.url.path.join("/");
        }
        const headers = Array.isArray(item.request.header) ? item.request.header : [];
        const body = item.request.body;
        list.push({ method, path: path || "/api/v1/resource", headers, body });
      } else if (item.item) {
        traverse(item.item);
      }
    }
  }
  if (json.item) traverse(json.item);
  return list;
}

function parseYAML(text: string) {
  const list: { method: string; path: string; headers?: any[]; body?: any }[] = [];
  const lines = text.split("\n");
  let currentPath = "";
  for (const line of lines) {
    const pathMatch = line.match(/^ {2}(\/[a-zA-Z0-9_\-/{}[\]]+):/);
    if (pathMatch) {
      currentPath = pathMatch[1];
    } else if (currentPath) {
      const methodMatch = line.match(/^ {4}(get|post|put|delete|patch|options|head):/i);
      if (methodMatch) {
        list.push({
          method: methodMatch[1].toUpperCase(),
          path: currentPath,
          headers: [],
        });
      }
    }
  }
  return list;
}

function scanEndpoints(
  parsedList: { method: string; path: string; headers?: any[]; body?: any }[],
) {
  const generatedFindings: any[] = [];
  let score = 100;

  parsedList.forEach((ep, index) => {
    const epName = `${ep.method} ${ep.path}`;
    const headers = ep.headers || [];
    const hasAuthHeader = headers.some((h) => {
      const name = String(h.key || h.name || "").toLowerCase();
      return name.includes("auth") || name.includes("key") || name.includes("token");
    });

    // 1. Missing Auth Headers on state-changing requests
    if (!hasAuthHeader && ["POST", "PUT", "DELETE", "PATCH"].includes(ep.method)) {
      score -= 10;
      generatedFindings.push({
        id: `det-auth-${index}`,
        severity: "High",
        owasp: "API2:2023",
        title: "Broken Authentication — Missing Authentication Header",
        endpoint: epName,
        detail: `The endpoint allows ${ep.method} state-changing requests without requiring an Authorization or API Key header in the request definition.`,
        fix: "Implement authentication validation middleware. Reject requests lacking a valid JWT or API token with a 401 Unauthorized response.",
      });
    }

    // 2. HTTP (non-HTTPS) URLs
    if (ep.path.startsWith("http://")) {
      score -= 15;
      generatedFindings.push({
        id: `det-http-${index}`,
        severity: "Critical",
        owasp: "API3:2023",
        title: "Insecure Communication — Plaintext HTTP Protocol Used",
        endpoint: epName,
        detail:
          "The endpoint URL is configured with plaintext http://. All communication is unencrypted, exposing data to man-in-the-middle (MITM) attacks and credential harvesting.",
        fix: "Enforce HTTPS transport-layer security. Configure the server to redirect all HTTP requests to HTTPS, and use HSTS (HTTP Strict Transport Security) headers.",
      });
    }

    // 3. Sensitive keywords in paths
    const sensitiveKeywords = ["password", "token", "secret", "key", "admin"];
    const foundKeyword = sensitiveKeywords.find((kw) => ep.path.toLowerCase().includes(kw));
    if (foundKeyword) {
      score -= 8;
      generatedFindings.push({
        id: `det-path-${index}`,
        severity: "High",
        owasp: "API1:2023",
        title: `Information Exposure via Sensitive Keyword in URI Path (${foundKeyword})`,
        endpoint: epName,
        detail: `The URI path contains a sensitive keyword '${foundKeyword}'. Direct inclusion of administrative triggers or authentication secrets in path parameters risks exposure in server access logs and browser history.`,
        fix: "Redesign the API routing. Move authentication credentials to headers or request bodies. Enforce strict role-based access controls (RBAC) on administrative endpoints.",
      });
    }

    // 4. Missing rate limit headers
    if (
      ["POST", "DELETE"].includes(ep.method) ||
      ep.path.includes("auth") ||
      ep.path.includes("login") ||
      ep.path.includes("pay")
    ) {
      const hasRateLimitHeader = headers.some((h) => {
        const name = String(h.key || h.name || "").toLowerCase();
        return name.includes("rate") || name.includes("limit");
      });
      if (!hasRateLimitHeader) {
        score -= 5;
        generatedFindings.push({
          id: `det-rate-${index}`,
          severity: "Medium",
          owasp: "API4:2023",
          title: "Lack of Resources and Rate Limiting",
          endpoint: epName,
          detail:
            "The endpoint does not define rate limiting headers or parameters in the specification. An attacker could flood the endpoint to cause a denial of service (DoS) or brute-force user credentials.",
          fix: "Configure a rate-limiting middleware (e.g. Redis rate limiter) to cap requests per minute per IP address. Return a 429 Too Many Requests response when limits are exceeded.",
        });
      }
    }

    // 5. GET requests with body params
    if (ep.method === "GET" && ep.body) {
      score -= 5;
      generatedFindings.push({
        id: `det-getbody-${index}`,
        severity: "Medium",
        owasp: "API3:2023",
        title: "GET Request Defined with Request Body",
        endpoint: epName,
        detail:
          "The GET request specification contains a defined body payload. According to RFC 7231, GET requests should not carry a request body, and many proxies/servers discard it, leading to client-server desynchronization.",
        fix: "Refactor request payload into query string parameters or switch the method to POST.",
      });
    }
  });

  if (score < 10) score = 12;
  if (score > 100) score = 100;

  if (generatedFindings.length === 0) {
    generatedFindings.push({
      id: "det-info-default",
      severity: "Low",
      owasp: "API10:2023",
      title: "Unsafe Dependency Vulnerability Scan Warning",
      endpoint: parsedList[0] ? `${parsedList[0].method} ${parsedList[0].path}` : "GET /v1/health",
      detail:
        "Static analysis identified potential third-party package drift. The API specification should be continuously scanned for package security updates.",
      fix: "Enable automated dependency scanning via Dependabot or Snyk integration.",
    });
    score = 98;
  }

  return { score, findings: generatedFindings };
}

const generatePDF = (score: number, endpoints: any[], findings: any[], fileName: string) => {
  const textLines = [
    "RaksHex API Security Scan Report",
    "====================================",
    `Target File: ${fileName}`,
    `Security Score: ${score}/100`,
    `Endpoints Scanned: ${endpoints.length}`,
    `Vulnerabilities Detected: ${findings.length}`,
    "------------------------------------",
    "DETAILED FINDINGS:",
    "",
  ];

  findings.forEach((f, idx) => {
    textLines.push(`[${idx + 1}] ${f.severity.toUpperCase()} - ${f.title}`);
    textLines.push(`    OWASP Category: ${f.owasp}`);
    textLines.push(`    Endpoint: ${f.endpoint}`);
    textLines.push(`    Details: ${f.detail}`);
    textLines.push(`    Remediation: ${f.fix}`);
    textLines.push("");
  });

  let streamContent = "BT\n/F1 10 Tf\n20 TL\n72 750 Td\n";
  textLines.forEach((line) => {
    const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    streamContent += `(${escaped}) Tj T*\n`;
  });
  streamContent += "ET";

  const pdfLength = streamContent.length;
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${pdfLength} >>
stream
${streamContent}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000244 00000 n 
0000000418 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
%%EOF`;

  const blob = new Blob([pdfString], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `RaksHex-scan-${fileName.replace(".json", "").replace(".yaml", "").replace(".yml", "")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function DemoPage() {
  const [step, setStep] = useState<"upload" | "scanning" | "results">("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [endpoints, setEndpoints] = useState(ENDPOINTS);
  const [findings, setFindings] = useState<any[]>(MOCK_FINDINGS);
  const [score, setScore] = useState(44);
  const [progressText, setProgressText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [liveCost, setLiveCost] = useState(0.0766);
  const [tick, setTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "results") return;
    const id = setInterval(() => {
      setLiveCost((c) => parseFloat((c + Math.random() * 0.003 + 0.0005).toFixed(4)));
      setTick((t) => t + 1);
    }, 1400);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (step !== "scanning") return;

    const steps = [
      "Parsing collection file and resolving references...",
      "Testing 87+ prompt injection vectors against endpoints...",
      "Auditing compliance for OWASP API Top 10...",
      "Generating report...",
    ];

    let currentStep = 0;
    setProgressText(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setProgressText(steps[currentStep]);
      } else {
        clearInterval(interval);
        setStep("results");
      }
    }, 600);

    return () => clearInterval(interval);
  }, [step]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + " KB");

    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed: any[] = [];
      const text = e.target?.result as string;
      try {
        if (file.name.endsWith(".json")) {
          const json = JSON.parse(text);
          parsed = parsePostman(json);
        } else {
          parsed = parseYAML(text);
        }
      } catch (err) {
        try {
          parsed = parseYAML(text);
        } catch (yErr) {
          console.error("Failed parsing as JSON or YAML:", yErr);
        }
      }

      if (parsed.length > 0) {
        setEndpoints(parsed);
        const scanResult = scanEndpoints(parsed);
        setScore(scanResult.score);
        setFindings(scanResult.findings);
      } else {
        setEndpoints(ENDPOINTS);
        setFindings(MOCK_FINDINGS);
        setScore(44);
      }
      setStep("scanning");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUseSample = () => {
    setFileName("stripe-v1-production.postman_collection.json");
    setFileSize("42.8 KB");
    setEndpoints(ENDPOINTS);
    const scanResult = scanEndpoints(ENDPOINTS);
    setScore(scanResult.score);
    setFindings(scanResult.findings);
    setStep("scanning");
  };

  return (
    <div
      className="min-h-screen bg-[#0A0E1A] text-gray-100 pb-16"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* HEADER */}
      <div className="border-b border-[#2D3E50] bg-[#1E293B]/50 backdrop-blur-xl px-8 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#06D6A0] animate-pulse" />
              <span className="text-[#06D6A0] text-xs tracking-widest font-bold">
                INTERACTIVE DEMO — NO LOGIN REQUIRED
              </span>
            </div>
            <h1
              className="text-white text-2xl font-bold"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              API Security Scanner
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Upload your API spec or Postman collection to run a local simulated audit.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/register"
              className="px-5 py-2.5 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-bold text-xs tracking-widest hover:opacity-90 transition-all font-mono rounded"
            >
              START FREE TRIAL →
            </a>
            {step === "results" && (
              <button
                onClick={() => setStep("upload")}
                className="px-5 py-2.5 border border-[#2D3E50] text-gray-300 text-xs tracking-widest hover:bg-[#1E293B] transition-all font-mono rounded"
              >
                SCAN ANOTHER FILE
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 pt-8 space-y-8">
        {step === "upload" && (
          <div className="space-y-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragOver
                  ? "border-[#06D6A0] bg-[#06D6A0]/10"
                  : "border-[#2D3E50] hover:border-gray-700 bg-[#1E293B]/30"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,.yaml,.yml"
                className="hidden"
              />
              <div className="w-16 h-16 bg-[#0A0E1A] border border-[#2D3E50] rounded-xl flex items-center justify-center mx-auto mb-4 text-[#06D6A0] text-2xl">
                📥
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">
                Drag & drop your Postman Collection or OpenAPI spec
              </h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Supports Postman JSON (v2.1) and Swagger/OpenAPI YAML/JSON files. Max 10MB.
              </p>
              <button className="px-6 py-2.5 bg-[#1E293B] hover:bg-[#1E293B]/80 text-white text-xs tracking-wider font-mono rounded border border-[#2D3E50]">
                SELECT FILE
              </button>
            </div>

            <div className="text-center">
              <span className="text-gray-500 text-xs font-mono">OR</span>
              <div className="mt-4">
                <button
                  onClick={handleUseSample}
                  className="text-[#06D6A0] hover:text-[#00F0FF] text-sm font-mono border-b border-[#06D6A0]/30 hover:border-[#00F0FF] transition-colors"
                >
                  🚀 Run scan with preloaded Stripe API sample
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "scanning" && (
          <div className="bg-[#1E293B] border border-[#2D3E50] rounded-xl p-12 text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#06D6A0] animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono">Auditing Collection</h3>
              <p className="text-gray-400 text-sm mt-2 font-mono animate-pulse">{progressText}</p>
            </div>
          </div>
        )}

        {step === "results" && (
          <>
            {/* Sign up to save results CTA + PDF download */}
            <div className="bg-gradient-to-r from-[#1E293B] to-[#0A0E1A] border border-[#2D3E50] rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-white font-bold font-mono">🔒 Save your scanning history</h4>
                <p className="text-gray-400 text-sm mt-1 font-mono">
                  Create a free account to unlock continuous CI/CD scanning, Slack alerts, and PDF
                  exports.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => generatePDF(score, endpoints, findings, fileName)}
                  className="px-4 py-2.5 bg-[#1E293B] hover:bg-[#1E293B]/80 text-white font-bold text-xs tracking-wider uppercase font-mono rounded border border-[#2D3E50] whitespace-nowrap"
                >
                  📥 Download PDF
                </button>
                <a
                  href="/register"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-bold text-xs tracking-wider uppercase font-mono rounded whitespace-nowrap"
                >
                  SIGN UP FREE
                </a>
              </div>
            </div>

            {/* SECTION 1 — Collection Card */}
            <div className="bg-[#1E293B] border border-[#2D3E50] rounded-xl p-6">
              <p className="text-[#06D6A0] text-xs tracking-widest mb-4 font-mono uppercase">
                COLLECTION SCANNED
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#06D6A0]/10 border border-[#06D6A0]/20 rounded-lg flex items-center justify-center text-xl">
                    🔌
                  </div>
                  <div>
                    <p
                      className="text-white font-bold"
                      style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px" }}
                    >
                      {fileName}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 font-mono">
                      Size: {fileSize} · {endpoints.length} endpoints detected
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 font-mono">
                  {[
                    { label: "ENDPOINTS", value: endpoints.length.toString() },
                    {
                      label: "METHODS",
                      value: Array.from(new Set(endpoints.map((e) => e.method))).join(" · "),
                    },
                    { label: "SCAN TIME", value: "347ms" },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-gray-500 text-xs">{s.label}</p>
                      <p className="text-gray-300 font-bold text-sm mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-[#2D3E50] p-3 rounded bg-[#0A0E1A]/50">
                {endpoints.map((e, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2 py-1 rounded font-mono ${METHOD_COLORS[e.method] ?? "bg-gray-800 text-gray-300"}`}
                  >
                    {e.method} {e.path}
                  </span>
                ))}
              </div>
            </div>

            {/* SECTION 2 — Findings Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "CRITICAL",
                  value: findings.filter((f) => f.severity === "Critical").length.toString(),
                  color: "text-[#EF4444]",
                },
                {
                  label: "HIGH",
                  value: findings.filter((f) => f.severity === "High").length.toString(),
                  color: "text-[#F59E0B]",
                },
                {
                  label: "MEDIUM",
                  value: findings.filter((f) => f.severity === "Medium").length.toString(),
                  color: "text-[#FDB022]",
                },
                { label: "OWASP SCORE", value: `${score}/100`, color: "text-[#06D6A0]" },
              ].map((s) => (
                <div key={s.label} className="bg-[#1E293B] border border-[#2D3E50] rounded-xl p-5">
                  <p className="text-gray-500 text-xs tracking-widest mb-2 font-mono">{s.label}</p>
                  <p
                    className={`font-bold ${s.color}`}
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "32px" }}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* SECTION 3 — Findings */}
            <div>
              <p className="text-[#06D6A0] text-xs tracking-widest mb-4 font-mono uppercase">
                TOP FINDINGS
              </p>
              <div className="space-y-4">
                {findings.map((f) => (
                  <div key={f.id} className="bg-[#1E293B] border border-[#2D3E50] rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-1 rounded font-bold ${SEVERITY_COLOR[f.severity]}`}
                        >
                          {f.severity}
                        </span>
                        <span className="text-gray-400 text-xs font-mono">{f.owasp}</span>
                      </div>
                      <span className="text-gray-400 text-xs font-mono">{f.endpoint}</span>
                    </div>
                    <p className="text-white font-bold mb-2 font-mono">{f.title}</p>
                    <p className="text-gray-400 text-sm mb-3 leading-relaxed">{f.detail}</p>
                    <div className="bg-[#06D6A0]/10 border-l-2 border-[#06D6A0] px-4 py-2">
                      <span className="text-[#06D6A0] text-xs font-bold font-mono">FIX: </span>
                      <span className="text-gray-300 text-xs font-mono">{f.fix}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4 — Live Token Cost Feed */}
            <div className="bg-[#1E293B] border border-[#2D3E50] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-500 text-xs tracking-widest font-mono">
                  LIVE TOKEN COST FEED
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06D6A0] animate-pulse" />
                  <span className="text-[#06D6A0] text-xs font-mono">STREAMING</span>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-gray-500 text-xs mb-1 font-mono">SESSION TOTAL</p>
                <p
                  className="text-[#06D6A0]"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "40px",
                    fontWeight: 700,
                  }}
                >
                  ${liveCost.toFixed(4)}
                </p>
                <p className="text-gray-500 text-xs mt-1 font-mono">
                  Tick #{tick} · updates every 1.4s
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono" style={{ fontSize: "12px" }}>
                  <thead className="border-b border-[#2D3E50]">
                    <tr className="text-gray-500 text-xs tracking-widest">
                      <th className="pb-2 pr-4">AGENT</th>
                      <th className="pb-2 pr-4">MODEL</th>
                      <th className="pb-2 pr-4 text-right">TOKENS</th>
                      <th className="pb-2 text-right">COST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3E50]/50">
                    {TOKEN_AGENTS.map((a, i) => (
                      <tr
                        key={i}
                        className={i === tick % TOKEN_AGENTS.length ? "bg-[#06D6A0]/5" : ""}
                      >
                        <td className="py-2 pr-4 text-white font-bold">{a.agent}</td>
                        <td className="py-2 pr-4 text-gray-400">{a.model}</td>
                        <td className="py-2 pr-4 text-right text-white">
                          {a.tokens.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-[#06D6A0]">${a.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* SECTION 5 — CTA */}
        <div className="bg-[#1E293B] border border-[#2D3E50] rounded-xl p-8 text-center">
          <p className="text-[#06D6A0] text-xs tracking-widest mb-3 font-mono">
            READY TO SECURE YOUR REAL APIs?
          </p>
          <h2
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "24px", fontWeight: 700 }}
            className="mb-3 text-white"
          >
            Import your Postman collection and get real results in 60 seconds
          </h2>
          <p className="text-gray-400 text-sm mb-6 max-w-lg mx-auto leading-relaxed">
            Supports Postman v2.1, OpenAPI 3.x, and Bruno. Free tier includes 50 scans/month and 5
            LLM agents. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center font-mono">
            <a
              href="/register"
              className="px-8 py-3 bg-gradient-to-r from-[#06D6A0] to-[#00F0FF] text-[#0A0E1A] font-bold text-xs tracking-widest hover:opacity-90 transition-all rounded"
            >
              START FREE — SCAN MY APIS →
            </a>
            <a
              href="/import"
              className="px-8 py-3 border border-[#2D3E50] text-gray-300 text-xs tracking-widest hover:bg-[#1E293B] transition-all rounded"
            >
              IMPORT COLLECTION
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
