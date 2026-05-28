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
  GET: "bg-blue-900/20 text-blue-400 border border-blue-800/30",
  POST: "bg-emerald-900/20 text-emerald-400 border border-emerald-800/30",
  DELETE: "bg-red-900/20 text-red-400 border border-red-800/30",
  PUT: "bg-amber-900/20 text-amber-400 border border-amber-800/30",
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

const SEVERITY_COLOR = {
  Critical: "text-red-400 bg-red-900/20 border border-red-500/30",
  High: "text-orange-400 bg-orange-950/20 border border-orange-500/30",
  Medium: "text-yellow-400 bg-yellow-950/20 border border-yellow-500/30",
  Low: "text-blue-400 bg-blue-950/20 border border-blue-500/30",
};

const TOKEN_AGENTS = [
  { agent: "stripe-billing-agent", model: "gpt-4o", tokens: 1420, cost: 0.0142 },
  { agent: "fraud-detection-llm", model: "claude-3-5-sonnet", tokens: 2830, cost: 0.0339 },
  { agent: "support-copilot", model: "gpt-4o-mini", tokens: 890, cost: 0.0027 },
  { agent: "invoice-summariser", model: "claude-3-haiku", tokens: 3100, cost: 0.0062 },
  { agent: "chargeback-analyst", model: "gpt-4o", tokens: 1960, cost: 0.0196 },
];

function parsePostman(json: any) {
  const list: { method: string, path: string }[] = [];
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
        list.push({ method, path: path || "/api/v1/resource" });
      } else if (item.item) {
        traverse(item.item);
      }
    }
  }
  if (json.item) traverse(json.item);
  return list;
}

export default function DemoPage() {
  const [step, setStep] = useState<"upload" | "scanning" | "results">("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [endpoints, setEndpoints] = useState(ENDPOINTS);
  const [findings, setFindings] = useState(MOCK_FINDINGS);
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
      "Generating report..."
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
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        const parsed = parsePostman(json);
        if (parsed.length > 0) {
          setEndpoints(parsed);
          // Customize findings with user's endpoints
          const updatedFindings = MOCK_FINDINGS.map((finding, idx) => {
            const endpoint = parsed[idx % parsed.length];
            return {
              ...finding,
              endpoint: `${endpoint.method} ${endpoint.path}`
            };
          });
          setFindings(updatedFindings);
        } else {
          setEndpoints(ENDPOINTS);
          setFindings(MOCK_FINDINGS);
        }
      } catch (err) {
        console.error("Failed to parse file, falling back to default mock data:", err);
        setEndpoints(ENDPOINTS);
        setFindings(MOCK_FINDINGS);
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
    setFindings(MOCK_FINDINGS);
    setStep("scanning");
  };

  return (
    <div
      className="min-h-screen bg-gray-950 text-gray-100 pb-16"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* HEADER */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl px-8 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-400 text-xs tracking-widest font-bold">
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
              className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs tracking-widest hover:bg-blue-700 transition-all font-mono rounded"
            >
              START FREE TRIAL →
            </a>
            {step === "results" && (
              <button
                onClick={() => setStep("upload")}
                className="px-5 py-2.5 border border-gray-700 text-gray-300 text-xs tracking-widest hover:bg-gray-800 transition-all font-mono rounded"
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
                  ? "border-blue-500 bg-blue-950/20"
                  : "border-gray-800 hover:border-gray-700 bg-gray-900/30"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,.yaml,.yml"
                className="hidden"
              />
              <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-400 text-2xl">
                📥
              </div>
              <h3 className="text-lg font-bold text-white mb-2 font-mono">
                Drag & drop your Postman Collection or OpenAPI spec
              </h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Supports Postman JSON (v2.1) and Swagger/OpenAPI YAML/JSON files. Max 10MB.
              </p>
              <button className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs tracking-wider font-mono rounded border border-gray-700">
                SELECT FILE
              </button>
            </div>

            <div className="text-center">
              <span className="text-gray-500 text-xs font-mono">OR</span>
              <div className="mt-4">
                <button
                  onClick={handleUseSample}
                  className="text-blue-400 hover:text-blue-300 text-sm font-mono border-b border-blue-500/30 hover:border-blue-400 transition-colors"
                >
                  🚀 Run scan with preloaded Stripe API sample
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "scanning" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono">Auditing Collection</h3>
              <p className="text-gray-400 text-sm mt-2 font-mono animate-pulse">{progressText}</p>
            </div>
          </div>
        )}

        {step === "results" && (
          <>
            {/* SECTION 1 — Collection Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <p className="text-blue-400 text-xs tracking-widest mb-4 font-mono uppercase">COLLECTION SCANNED</p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-900/30 border border-blue-800/30 rounded-lg flex items-center justify-center text-xl">
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
                    { label: "METHODS", value: Array.from(new Set(endpoints.map((e) => e.method))).join(" · ") },
                    { label: "SCAN TIME", value: "347ms" },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-gray-500 text-xs">{s.label}</p>
                      <p className="text-gray-300 font-bold text-sm mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-800 p-3 rounded bg-gray-950/50">
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
                { label: "CRITICAL", value: findings.filter(f => f.severity === "Critical").length.toString(), color: "text-red-400" },
                { label: "HIGH", value: findings.filter(f => f.severity === "High").length.toString(), color: "text-orange-400" },
                { label: "MEDIUM", value: findings.filter(f => f.severity === "Medium").length.toString(), color: "text-yellow-400" },
                { label: "OWASP SCORE", value: "44/100", color: "text-blue-400" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
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
              <p className="text-blue-400 text-xs tracking-widest mb-4 font-mono uppercase">TOP FINDINGS</p>
              <div className="space-y-4">
                {findings.map((f) => (
                  <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
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
                    <p
                      className="text-white font-bold mb-2 font-mono"
                    >
                      {f.title}
                    </p>
                    <p className="text-gray-400 text-sm mb-3 leading-relaxed">{f.detail}</p>
                    <div className="bg-blue-900/10 border-l-2 border-blue-500 px-4 py-2">
                      <span className="text-blue-400 text-xs font-bold font-mono">FIX: </span>
                      <span className="text-gray-300 text-xs font-mono">{f.fix}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4 — Live Token Cost Feed */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-500 text-xs tracking-widest font-mono">LIVE TOKEN COST FEED</p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-blue-400 text-xs font-mono">STREAMING</span>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-gray-500 text-xs mb-1 font-mono">SESSION TOTAL</p>
                <p
                  className="text-blue-400"
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
                  <thead className="border-b border-gray-800">
                    <tr className="text-gray-500 text-xs tracking-widest">
                      <th className="pb-2 pr-4">AGENT</th>
                      <th className="pb-2 pr-4">MODEL</th>
                      <th className="pb-2 pr-4 text-right">TOKENS</th>
                      <th className="pb-2 text-right">COST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-850">
                    {TOKEN_AGENTS.map((a, i) => (
                      <tr key={i} className={i === tick % TOKEN_AGENTS.length ? "bg-blue-900/5" : ""}>
                        <td className="py-2 pr-4 text-white font-bold">{a.agent}</td>
                        <td className="py-2 pr-4 text-gray-400">{a.model}</td>
                        <td className="py-2 pr-4 text-right text-white">
                          {a.tokens.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-blue-400">${a.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* SECTION 5 — CTA */}
        <div className="bg-gray-900 border border-gray-850 rounded-xl p-8 text-center border-blue-950">
          <p className="text-blue-400 text-xs tracking-widest mb-3 font-mono">
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
              className="px-8 py-3 bg-blue-600 text-white font-bold text-xs tracking-widest hover:bg-blue-700 transition-all rounded"
            >
              START FREE — SCAN MY APIS →
            </a>
            <a
              href="/import"
              className="px-8 py-3 border border-gray-700 text-gray-300 text-xs tracking-widest hover:bg-gray-800 transition-all rounded"
            >
              IMPORT COLLECTION
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

