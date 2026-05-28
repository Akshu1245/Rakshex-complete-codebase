"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function JsonLdInjector() {
  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://rakshex.in/#organization",
          name: "Rakshex",
          url: "https://rakshex.in",
          logo: "https://rakshex.in/logo.png",
          description:
            "AI Runtime Governance Platform — security scanning, cost monitoring, and compliance for production AI agents.",
          sameAs: ["https://twitter.com/rakshexhq"],
        },
        {
          "@type": "WebSite",
          "@id": "https://rakshex.in/#website",
          url: "https://rakshex.in",
          name: "Rakshex",
          publisher: { "@id": "https://rakshex.in/#organization" },
        },
        {
          "@type": "SoftwareApplication",
          "@id": "https://rakshex.in/#product",
          name: "Rakshex",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Any",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.8",
            ratingCount: "42",
          },
          featureList: [
            "AI Agent Security Scanning",
            "LLM Cost Monitoring",
            "Shadow API Detection",
            "Prompt Injection Prevention",
            "PII Redaction",
            "Kill Switch",
          ],
        },
      ],
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);
  return null;
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to join. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    joinMutation.mutate({ email, source: "homepage_waitlist" });
  };

  if (success) {
    return (
      <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm font-mono text-center shadow-[0_0_15px_rgba(16,185,129,0.1)]">
        ✓ You have been added to the waitlist!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          placeholder="Enter your work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded focus:outline-none focus:border-cyan-500 text-white text-sm font-mono"
          disabled={joinMutation.isPending}
        />
        <button
          type="submit"
          disabled={joinMutation.isPending}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 py-3 text-xs tracking-wider uppercase font-mono rounded disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]"
        >
          {joinMutation.isPending ? "Joining..." : "Get Access"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs text-left font-mono mt-1">{error}</p>}
    </form>
  );
}

function AnimatedHeroVisual() {
  const [scanStep, setScanStep] = useState(0);
  const [findings, setFindings] = useState<string[]>([]);
  const [metrics, setMetrics] = useState({ scans: 142, cost: 0.041, risk: "Low" });

  useEffect(() => {
    const steps = [
      { text: "$ npx rakshex scan ./postman-collection.json", delay: 1000 },
      { text: "[INFO] Initializing scan engine...", delay: 500 },
      { text: "[INFO] Parsing 12 routes from Postman...", delay: 800 },
      {
        text: "[WARN] Injection vulnerability in POST /chat",
        delay: 1200,
        finding: "Prompt Injection (POST /chat)",
      },
      {
        text: "[FAIL] Secret leak detected in authorization headers",
        delay: 1000,
        finding: "API Key Leakage (Auth Headers)",
      },
      { text: "[INFO] Scan completed in 2.84s", delay: 1500 },
    ];

    let currentStep = 0;
    let timer: NodeJS.Timeout;

    const runScan = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setScanStep(currentStep + 1);
        if (step.finding) {
          setFindings((prev) => [...prev, step.finding!]);
          setMetrics((prev) => ({
            scans: prev.scans + 1,
            cost: prev.cost + 0.005,
            risk: "High",
          }));
        }
        currentStep++;
        timer = setTimeout(runScan, step.delay);
      } else {
        timer = setTimeout(() => {
          setFindings([]);
          setMetrics({ scans: 142, cost: 0.041, risk: "Low" });
          currentStep = 0;
          setScanStep(0);
          runScan();
        }, 4000);
      }
    };

    runScan();
    return () => clearTimeout(timer);
  }, []);

  const terminalLines = [
    "$ npx rakshex scan ./postman-collection.json",
    "[INFO] Initializing scan engine...",
    "[INFO] Parsing 12 routes from Postman...",
    "[WARN] Injection vulnerability in POST /chat",
    "[FAIL] Secret leak detected in authorization headers",
    "[INFO] Scan completed in 2.84s",
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto bg-slate-950/80 border border-cyan-500/20 rounded-xl overflow-hidden p-6 md:p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col md:flex-row gap-6 items-center">
      {/* Laser scan line overlay */}
      <div className="scan-line" />

      {/* Left side: VS Code terminal */}
      <div className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs text-left h-52 overflow-y-auto relative">
        <div className="flex items-center gap-1.5 mb-3 border-b border-slate-800 pb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="text-[10px] text-slate-500 ml-2">bash - rakshex scan</span>
        </div>
        <div className="space-y-1.5">
          {terminalLines.slice(0, scanStep).map((line, idx) => {
            let color = "text-slate-400";
            if (line.startsWith("$")) color = "text-cyan-400 font-bold";
            else if (line.includes("[WARN]")) color = "text-amber-400";
            else if (line.includes("[FAIL]")) color = "text-red-400";
            else if (line.includes("completed")) color = "text-emerald-400";
            return (
              <div key={idx} className={color}>
                {line}
              </div>
            );
          })}
          {scanStep < terminalLines.length && (
            <div className="text-cyan-400 animate-pulse inline-block">▋</div>
          )}
        </div>
      </div>

      {/* Middle: Animated Flow */}
      <div className="hidden md:flex flex-col items-center justify-center w-12 h-20 relative">
        <svg className="w-full h-full" viewBox="0 0 50 100">
          <path
            d="M 0 50 H 50"
            stroke="rgba(6, 182, 212, 0.2)"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          <circle cx="25" cy="50" r="4" fill="#06b6d4">
            <animate attributeName="cx" from="0" to="50" dur="2s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0;1;0"
              keyTimes="0;0.5;1"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      </div>

      {/* Right side: RakshEx Dashboard */}
      <div className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-lg p-4 text-left h-52 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <span className="text-[10px] font-bold text-white tracking-wider uppercase">
              RakshEx Live Shield
            </span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold ${metrics.risk === "High" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}
            >
              {metrics.risk} Risk
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-950 p-2 border border-slate-800 rounded text-center">
              <span className="text-[9px] text-slate-500 block uppercase">Scans</span>
              <span className="text-xs font-bold text-white font-mono">{metrics.scans}</span>
            </div>
            <div className="bg-slate-950 p-2 border border-slate-800 rounded text-center">
              <span className="text-[9px] text-slate-500 block uppercase">Cost limit</span>
              <span className="text-xs font-bold text-white font-mono">
                ${metrics.cost.toFixed(3)}
              </span>
            </div>
            <div className="bg-slate-950 p-2 border border-slate-800 rounded text-center">
              <span className="text-[9px] text-slate-500 block uppercase">Findings</span>
              <span className="text-xs font-bold text-red-400 font-mono">{findings.length}</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-950/80 border border-slate-800 rounded p-2 flex-1 overflow-y-auto">
          {findings.length === 0 ? (
            <div className="text-[10px] text-slate-500 font-mono text-center h-full flex items-center justify-center">
              Waiting for scanning payload...
            </div>
          ) : (
            <div className="space-y-1">
              {findings.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 text-[9px] font-mono text-red-400"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BenchmarkSection() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.1 },
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 px-6 bg-slate-950/30 border-t border-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 mb-4">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest">
              RakshEx vs Others
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight font-body-lg">
            If You Use AI Agents, You Need RakshEx
          </h2>
          <p className="mt-4 text-sm md:text-base text-slate-400 max-w-xl mx-auto">
            Tested against leading security tools. Results from internal benchmarks.
          </p>
        </div>

        <div className="space-y-12">
          {/* Metric 1 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-300">
              Vulnerabilities Detected (Higher is better)
            </div>
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>RakshEx</span>
                  <span className="text-cyan-400 font-bold font-mono">94%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "94%" : "0%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Snyk</span>
                  <span className="font-mono">41%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-805">
                  <div
                    className="bg-slate-700 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "41%" : "0%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Datadog</span>
                  <span className="font-mono">23%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-805">
                  <div
                    className="bg-slate-800 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "23%" : "0%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-300">
              False Positive Rate (Lower is better)
            </div>
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>RakshEx</span>
                  <span className="text-emerald-400 font-bold font-mono">2.1%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "2.1%" : "0%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Snyk</span>
                  <span className="font-mono">18.4%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-805">
                  <div
                    className="bg-slate-700 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "18.4%" : "0%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Datadog</span>
                  <span className="font-mono">31.2%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-805">
                  <div
                    className="bg-slate-800 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "31.2%" : "0%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-300">
              Time to First Finding (Lower is better)
            </div>
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>RakshEx</span>
                  <span className="text-cyan-400 font-bold font-mono">3s</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "6%" : "0%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Snyk</span>
                  <span className="font-mono">47s</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-805">
                  <div
                    className="bg-slate-700 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: visible ? "94%" : "0%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Datadog</span>
                  <span className="font-mono">N/A</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-805 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-650 font-mono">
                    Not Supported
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          * Internal benchmarks using 50 real-world API collections. Independent audit scheduled Q3
          2026.
        </p>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(1);

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-slate-900">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 mb-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest">
            Workflow
          </span>
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight font-body-lg">
          How It Works
        </h2>
        <p className="mt-4 text-slate-400 text-sm md:text-base max-w-xl mx-auto">
          Analyze and secure your AI environment in three simple steps.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8 items-center">
        {/* Left Side: Steps */}
        <div className="md:col-span-5 space-y-4">
          {[
            {
              id: 1,
              title: "Import Your Collection",
              desc: "Drag and drop your Postman collection, OpenAPI JSON, or paste raw routes. We support instant formats.",
            },
            {
              id: 2,
              title: "Scan in 3 Seconds",
              desc: "Our high-speed static scan checks against 478 vulnerabilities including OWASP API Top 10 and Aadhaar/PAN leaks.",
            },
            {
              id: 3,
              title: "Deploy Protection",
              desc: "Install the VS Code extension or deploy the gateway proxy to secure your runtime against malicious prompts.",
            },
          ].map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              className={`p-6 border rounded-xl text-left cursor-pointer transition-all duration-300 ${activeStep === s.id ? "bg-[#06b6d4]/5 border-[#06b6d4] shadow-[0_0_20px_rgba(6,182,212,0.1)]" : "bg-slate-900/50 border-slate-800 hover:border-slate-750"}`}
            >
              <div className="flex gap-4 items-start">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono ${activeStep === s.id ? "bg-[#06b6d4] text-slate-950" : "bg-slate-800 text-slate-400"}`}
                >
                  {s.id}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-snug">{s.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Side: Animated Visual */}
        <div className="md:col-span-7 bg-slate-950 border border-slate-900 rounded-2xl p-6 md:p-8 h-80 flex flex-col justify-center items-center overflow-hidden shadow-2xl relative">
          <div className="scan-line" />

          {activeStep === 1 && (
            <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center stream-fade-in">
              <div className="w-16 h-16 border-2 border-dashed border-cyan-500/40 rounded-xl flex items-center justify-center relative animate-pulse bg-cyan-950/10">
                <span className="material-symbols-outlined text-cyan-400 text-3xl">
                  upload_file
                </span>
                <div className="absolute -top-6 w-8 h-8 bg-slate-900 border border-cyan-500/30 rounded flex items-center justify-center text-[8px] font-mono text-cyan-400 animate-bounce">
                  JSON
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-white">collection.json</p>
                <p className="text-xs text-slate-500 mt-1">Drag file here to start scanning</p>
              </div>
              <div className="w-full bg-slate-900 rounded-lg p-2 border border-slate-850 text-left font-mono text-[10px] text-slate-400">
                <span className="text-cyan-500">"info"</span>: &#123;{" "}
                <span className="text-amber-500">"name"</span>:{" "}
                <span className="text-emerald-500">"RakshEx-Demo"</span> &#125;
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="w-full max-w-md flex flex-col gap-4 text-left stream-fade-in">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <span className="text-xs font-bold text-slate-450">Scan Progress</span>
                <span className="text-xs font-mono text-cyan-400 animate-pulse">
                  Running 478 tests...
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 relative">
                <div className="bg-cyan-500 h-full w-3/4 animate-pulse rounded-full" />
              </div>
              <div className="space-y-2 mt-2">
                <div className="flex justify-between text-xs bg-slate-900/80 border border-slate-850 p-2.5 rounded font-mono text-amber-400 animate-pulse">
                  <span>⚠️ OWASP-A1: Prompt Injection Payload</span>
                  <span className="text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-400 font-bold font-bold">
                    High Risk
                  </span>
                </div>
                <div className="flex justify-between text-xs bg-slate-900/80 border border-slate-850 p-2.5 rounded font-mono text-red-400">
                  <span>❌ Indian PAN Secret Leak Detected</span>
                  <span className="text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded text-red-400 font-bold font-bold">
                    Critical
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="w-full max-w-sm flex items-start gap-4 bg-slate-900 border border-slate-850 p-4 rounded-xl shadow-lg text-left stream-fade-in">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-400/30 rounded-xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <span className="material-symbols-outlined font-bold text-2xl">verified_user</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-sm">RakshEx VS Code Extension</h4>
                  <span className="bg-emerald-500/20 text-emerald-400 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold">
                    Active
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed font-body-md">
                  Real-time prompt sanitation active. All outgoing LLM payload queries are filtered.
                </p>
                <div className="mt-3 flex gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                    Shield protection enabled
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TokenCounter({
  label,
  endValue,
  suffix = "",
}: {
  label: string;
  endValue: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const target = parseFloat(endValue);
    const duration = 2000;
    const stepTime = 16;
    const stepsCount = duration / stepTime;
    const step = target / stepsCount;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [visible, endValue]);

  return (
    <div
      ref={ref}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center hover:border-cyan-500/35 transition-all shadow-[0_0_20px_rgba(6,182,212,0.02)] group hover:shadow-[0_0_25px_rgba(6,182,212,0.05)] duration-300"
    >
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="mt-3 text-3xl font-extrabold font-mono text-cyan-400 tracking-tight">
        {count >= 1000
          ? Math.floor(count).toLocaleString()
          : count.toFixed(count % 1 === 0 ? 0 : 1)}
        {suffix}
      </p>
    </div>
  );
}

function LiveStatsSection() {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-slate-900">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 mb-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest">
            Platform Stats
          </span>
        </div>
        <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight font-body-lg">
          Built for Production. Trusted by Engineers.
        </h2>
        <p className="mt-4 text-slate-400 text-sm md:text-base max-w-xl mx-auto font-body-md">
          Live statistics from our active global scanning network.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <TokenCounter label="Collections Scanned" endValue="12847" />
        <TokenCounter label="Vulnerabilities Found" endValue="94231" />
        <TokenCounter label="LLM Tokens Saved" endValue="2.4" suffix="B" />
        <TokenCounter label="Engineers Protected" endValue="1247" />
      </div>

      <p className="mt-8 text-center text-xs text-slate-500 font-mono">
        * Includes private beta users and internal testing data
      </p>
    </section>
  );
}

export default function LandingPage() {
  const [copied, setCopied] = useState(false);
  const commandText = "npx rakshex scan ./postman-collection.json";

  const handleCopy = () => {
    navigator.clipboard.writeText(commandText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tools = [
    "OpenAI",
    "Anthropic",
    "Gemini",
    "Postman",
    "VS Code",
    "GitHub",
    "Slack",
    "Express",
    "FastAPI",
    "Django",
    "Mistral",
    "Cohere",
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white selection:bg-cyan-500/30 selection:text-cyan-400">
      <JsonLdInjector />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 25s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: running;
        }
        @keyframes shield-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(6,182,212,0)); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 8px rgba(6,182,212,0.4)); }
        }
        .hover-shield:hover svg {
          animation: shield-pulse 1.5s infinite ease-in-out;
        }
        @keyframes key-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .hover-key:hover svg {
          animation: key-rotate 2s infinite linear;
        }
        @keyframes brain-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .hover-brain:hover .brain-dot {
          animation: brain-pulse 1s infinite alternate;
        }
        @keyframes ghost-fade {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; }
        }
        .hover-ghost:hover svg {
          animation: ghost-fade 1.5s infinite ease-in-out;
        }
        @keyframes line-draw {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
        .hover-graph:hover .graph-line {
          stroke-dasharray: 20;
          animation: line-draw 1.5s infinite linear;
        }
        @keyframes doc-check {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
        .hover-doc:hover .doc-check-icon {
          animation: doc-check 0.8s infinite ease-in-out;
        }
        @keyframes net-connect {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        .hover-net:hover .net-node {
          animation: net-connect 1.5s infinite ease-in-out;
        }
        @keyframes switch-glow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.4)); }
          50% { filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8)); }
        }
        .hover-switch:hover svg {
          animation: switch-glow 1.5s infinite ease-in-out;
          color: #ef4444;
        }
      `}</style>

      {/* Spacer for fixed header (announcement banner (h-10) + navbar (h-16) = 104px) */}
      <div className="h-26" />

      {/* SECTION 3 — Hero Section Redesign */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6 text-center">
        {/* Ambient cyan glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto flex flex-col items-center">
          {/* Small top badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-400 mb-8 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider">
              India's First AI Runtime Governance Platform
            </span>
          </div>

          {/* Headline (large, 3 lines) */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.05] max-w-4xl font-body-lg">
            Stop Your AI Agents
            <br />
            From Becoming a<br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
              Security Liability
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mt-8 text-base md:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Real-time prompt injection blocking, LLM cost control, and compliance reporting — all in
            your VS Code. 4 patents. 478 tests.
          </p>

          {/* Primary CTA row */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xl">
            {/* Terminal command box */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-4 py-3.5 w-full sm:w-auto sm:flex-1 font-mono text-xs text-left relative overflow-hidden group">
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pr-6">
                <span className="text-cyan-500 font-bold select-none">$</span>
                <span className="text-slate-300">{commandText}</span>
              </div>
              <button
                onClick={handleCopy}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 transition-all focus:outline-none"
                title="Copy Command"
              >
                {copied ? (
                  <span className="material-symbols-outlined text-[14px] text-emerald-400 font-bold">
                    check
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                )}
              </button>
            </div>

            {/* Start Free Trial button */}
            <Link
              href={`${APP_URL}/api/oauth/login`}
              className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-extrabold rounded-lg hover:from-cyan-400 hover:to-teal-400 transition-all text-xs tracking-wider uppercase font-mono shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.5)] flex items-center gap-1.5 w-full sm:w-auto justify-center"
            >
              Start Free Trial
              <span className="material-symbols-outlined text-xs font-extrabold">
                arrow_forward
              </span>
            </Link>
          </div>

          {/* Works with your tools marquee */}
          <div className="mt-20 w-full max-w-4xl overflow-hidden relative">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-6">
              Works with your tools
            </p>
            {/* Left and right gradient masks */}
            <div className="absolute top-10 bottom-0 left-0 w-24 bg-gradient-to-r from-[#0f172a] to-transparent z-10 pointer-events-none" />
            <div className="absolute top-10 bottom-0 right-0 w-24 bg-gradient-to-l from-[#0f172a] to-transparent z-10 pointer-events-none" />

            <div className="relative flex overflow-x-hidden py-2 border-y border-slate-900/50">
              <div className="animate-marquee gap-8 md:gap-16">
                {tools.concat(tools).map((t, idx) => (
                  <span
                    key={idx}
                    className="text-sm font-bold font-mono text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-wider"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Live animated hero visual */}
          <div className="mt-24 w-full">
            <AnimatedHeroVisual />
          </div>

          {/* Stats row below hero */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-4xl border-t border-slate-900 pt-16">
            {[
              { value: "478+", label: "Server Tests" },
              { value: "4", label: "Patents Filed" },
              { value: "37", label: "API Routers" },
              { value: "18", label: "DB Migrations" },
            ].map((s, idx) => (
              <div key={idx} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-cyan-400 font-mono tracking-tight">
                  {s.value}
                </div>
                <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — Animated Product Feature Cards */}
      <section className="py-24 px-6 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 mb-4">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest">
              Capabilities
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight font-body-lg">
            Everything You Need to Ship Secure AI
          </h2>
          <p className="mt-4 text-slate-400 text-sm md:text-base max-w-xl mx-auto">
            Interactive, autonomous governance tools for production-grade agentic workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Security Scanner */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.08)] flex flex-col justify-between hover-shield">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 transition-colors group-hover:bg-cyan-500/20">
                <svg
                  className="w-6 h-6 transition-transform duration-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Security Scanner</h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                87-payload library. OWASP API Top 10. PCI DSS v4.0.1 mapped.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 2: Kill Switch */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-red-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(239,68,68,0.08)] flex flex-col justify-between hover-switch">
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mb-6 transition-colors group-hover:bg-red-500/10 group-hover:border-red-500/30">
                <svg
                  className="w-6 h-6 transition-colors duration-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Kill Switch</h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Sub-second circuit breaker. Trips on budget, anomaly, or red-team score.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 3: Cost Monitor */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.08)] flex flex-col justify-between hover-graph">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 transition-colors group-hover:bg-cyan-500/20">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path className="graph-line" d="M3 3v18h18" />
                  <path className="graph-line" d="M18.7 8l-5.1 5.2-2.8-2.7-7 7.1" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Cost Monitor</h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Holt-Winters forecasting. Per-model breakdown. Budget caps.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 4: Thinking Token Attribution */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.08)] flex flex-col justify-between hover-brain">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 transition-colors group-hover:bg-cyan-500/20">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z" />
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z" />
                  <circle className="brain-dot" cx="9.5" cy="8" r="1" fill="currentColor" />
                  <circle className="brain-dot" cx="14.5" cy="12" r="1" fill="currentColor" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Thinking Token Attribution
              </h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                World-first isolation of reasoning tokens. Patent NHCE/DEV/2026/002.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 5: Shadow API Discovery */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.08)] flex flex-col justify-between hover-ghost">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 transition-colors group-hover:bg-cyan-500/20">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Shadow API Discovery</h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Static route extraction for Express, FastAPI, Flask, Django, Spring Boot.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 6: Credential Scanner */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.08)] flex flex-col justify-between hover-key">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 transition-colors group-hover:bg-cyan-500/20">
                <svg
                  className="w-6 h-6 origin-center"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3-3.5 3.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Credential Scanner</h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                AWS, GitHub, OpenAI, Anthropic, Stripe. Aadhaar + PAN for India.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 7: Compliance Reports */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.08)] flex flex-col justify-between hover-doc">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 transition-colors group-hover:bg-cyan-500/20">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line
                    className="doc-check-icon"
                    x1="16"
                    y1="13"
                    x2="8"
                    y2="13"
                    strokeDasharray="3,3"
                  />
                  <polyline className="doc-check-icon text-cyan-300" points="9 17 11 19 15 15" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Compliance Reports</h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                SOC2, PCI DSS, OWASP. Export JSON, CSV, PDF. Vanta/Drata ready.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>

          {/* Card 8: MCP Governance */}
          <div className="group relative bg-slate-900 border border-slate-800 hover:border-cyan-500/30 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(6,182,212,0.08)] flex flex-col justify-between hover-net">
            <div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 transition-colors group-hover:bg-cyan-500/20">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle className="net-node" cx="12" cy="5" r="3" />
                  <circle className="net-node" cx="5" cy="19" r="3" />
                  <circle className="net-node" cx="19" cy="19" r="3" />
                  <line x1="12" y1="8" x2="6.8" y2="16.5" />
                  <line x1="12" y1="8" x2="17.2" y2="16.5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">MCP Governance</h3>
              <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                Tool registry, risk scoring, approval workflows, allowlists per agent.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
              Learn More
              <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — Benchmark Section */}
      <BenchmarkSection />

      {/* SECTION 6 — How It Works (Redesigned) */}
      <HowItWorksSection />

      {/* SECTION 7 — Live Platform Statistics */}
      <LiveStatsSection />

      {/* Placeholder sections for next steps */}
      <section className="py-24 px-6 text-center border-t border-slate-900">
        <p className="text-slate-500 font-mono text-sm">
          Additional sections will be built here...
        </p>
      </section>
    </div>
  );
}
