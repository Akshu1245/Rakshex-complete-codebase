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
          animation-play-state: running; /* Do not pause on hover */
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

      {/* Placeholder sections for next steps */}
      <section className="py-24 px-6 text-center border-t border-slate-900">
        <p className="text-slate-500 font-mono text-sm">
          Additional sections will be built here...
        </p>
      </section>
    </div>
  );
}
