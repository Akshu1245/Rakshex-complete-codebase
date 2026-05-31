"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useScrollReveal } from "@/lib/animations/scroll-reveal";
import { HeroSection } from "@/components/home/HeroSection";
import { FeatureCards } from "@/components/home/FeatureCards";
import { BenchmarkSection } from "@/components/home/BenchmarkSection";
import { ChangelogSection } from "@/components/home/ChangelogSection";
import { AskAISection } from "@/components/home/AskAISection";
import { InstallSection } from "@/components/home/InstallSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Footer } from "@/components/layout/Footer";
import {
  Shield,
  Power,
  Ghost,
  Key,
  BarChart,
  Brain,
  FileText,
  Network,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Menu,
  X,
  Play,
  Clipboard,
  Check,
} from "lucide-react";

// Rolling digit counter component matching scraped style
interface RollingDigitProps {
  char: string;
  trigger: boolean;
}

function RollingDigit({ char, trigger }: RollingDigitProps) {
  const isDigit = /\d/.test(char);
  const targetDigit = isDigit ? parseInt(char, 10) : 0;
  const [digit, setDigit] = useState(0);

  useEffect(() => {
    if (trigger && isDigit) {
      const t = setTimeout(() => {
        setDigit(targetDigit);
      }, 200);
      return () => clearTimeout(t);
    } else {
      setDigit(0);
    }
  }, [trigger, targetDigit, isDigit]);

  if (!isDigit) {
    return (
      <span
        aria-hidden="true"
        className="PlatformStatsShowcase_digitSlot__6p_aH PlatformStatsShowcase_comma__2_vA9"
      >
        <span className="PlatformStatsShowcase_digitTrack__F2EJi">
          <span className="PlatformStatsShowcase_digitChar__y2wrD">{char}</span>
        </span>
      </span>
    );
  }

  return (
    <span aria-hidden="true" className="PlatformStatsShowcase_digitSlot__6p_aH">
      <span
        className="PlatformStatsShowcase_digitTrack__F2EJi transition-transform duration-[1200ms] cubic-bezier(0.16, 1, 0.3, 1)"
        style={{ transform: `translateY(-${digit * 1.1}em)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="PlatformStatsShowcase_digitChar__y2wrD">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

function StatsCard({ label, targetValue }: { label: string; targetValue: string }) {
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <article
      ref={containerRef}
      className="w-full bg-[#1A1F2E] border border-[#14B8A6]/10 hover:border-[#14B8A6]/35 rounded-lg p-6 flex flex-col items-center gap-2 transition-all duration-200 select-none hover:shadow-[0_2px_8px_rgba(20,184,166,0.05)] text-center"
    >
      <p className="text-[#9CA3AF] font-sans text-xs tracking-wider uppercase font-semibold">
        {label}
      </p>
      <div
        aria-label={targetValue}
        className="text-[#14B8A6] font-sans font-extrabold text-3xl md:text-4xl"
      >
        {targetValue.split("").map((char, idx) => (
          <RollingDigit key={idx} char={char} trigger={inView} />
        ))}
      </div>
    </article>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("https://api.rakshex.in/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSuccess(true);
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-[#14B8A6]/10 border border-[#14B8A6]/30 rounded-[6px] text-[#14B8A6] text-sm font-mono text-center">
        ✓ You&apos;re on the list! We&apos;ll be in touch.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          placeholder="Enter your work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-4 py-3 bg-[#1A1F2E] border border-[#14B8A6] hover:border-[#0D9488] focus:border-2 focus:border-[#14B8A6] focus:outline-none text-white placeholder-[#6B7280] rounded-[6px] text-sm font-sans transition-all duration-150"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-[#14B8A6] hover:bg-[#0D9488] active:bg-[#0A7F6F] text-white hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.2)] font-semibold px-6 py-3 text-sm tracking-wide font-sans rounded-[6px] disabled:opacity-50 transition-all duration-200 shrink-0 transform"
        >
          {pending ? "Joining..." : "Join Waitlist"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs text-left font-mono mt-1">{error}</p>}
    </form>
  );
}

function AnimatedHeroVisual() {
  const [scanStep, setScanStep] = useState(0);
  const [findings, setFindings] = useState<string[]>([]);
  const [securityScore, setSecurityScore] = useState(100);

  useEffect(() => {
    const steps = [
      { text: "> RaksHex scan ./api.json", delay: 1200 },
      { text: "✓ 23 endpoints scanned", delay: 800 },
      { text: "⚠ 2 credentials detected", delay: 800, finding: "Credential Leak", score: 98 },
      { text: "🔒 1 prompt injection blocked", delay: 800, finding: "Prompt Injection", score: 95 },
      { text: "💰 $47.3 cost anomaly flagged", delay: 800, finding: "Cost Anomaly", score: 94 },
    ];

    let currentStep = 0;
    let timer: NodeJS.Timeout;

    const runScan = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setScanStep(currentStep + 1);
        if (step.finding) {
          setFindings((prev) => [...prev, step.finding!]);
        }
        if (step.score) {
          setSecurityScore(step.score);
        }
        currentStep++;
        timer = setTimeout(runScan, step.delay);
      } else {
        timer = setTimeout(() => {
          setFindings([]);
          setSecurityScore(100);
          currentStep = 0;
          setScanStep(0);
          runScan();
        }, 5000);
      }
    };

    runScan();
    return () => clearTimeout(timer);
  }, []);

  const terminalLines = [
    "> RaksHex scan ./api.json",
    "✓ 23 endpoints scanned",
    "⚠ 2 credentials detected",
    "🔒 1 prompt injection blocked",
    "💰 $47.3 cost anomaly flagged",
  ];

  return (
    <div className="w-full max-w-[680px] rounded-xl border border-neutral-700 bg-gradient-to-br from-[#232323] to-[#1C1C1C] flex flex-col md:flex-row p-6 gap-6 items-stretch shadow-2xl relative">
      {/* Left panel: VS Code terminal */}
      <div className="flex-1 bg-[#0F0F0F] rounded-lg p-5 font-mono text-xs text-left h-52 relative border border-neutral-800 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 mb-3 border-b border-neutral-800 pb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="text-[10px] text-neutral-500 ml-2">bash - RaksHex scan</span>
        </div>
        <div className="space-y-2 flex-1 overflow-y-auto">
          {terminalLines.slice(0, scanStep).map((line, idx) => {
            let color = "text-neutral-300";
            if (line.startsWith("✓")) color = "text-teal-accent";
            else if (line.startsWith("⚠")) color = "text-slate-400";
            else if (line.startsWith("🔒")) color = "text-teal-accent";
            else if (line.startsWith("💰")) color = "text-teal-accent";
            return (
              <p key={idx} className={`${color} font-mono leading-relaxed`}>
                {line}
              </p>
            );
          })}
          {scanStep < terminalLines.length && (
            <span className="inline-block w-1.5 h-3 bg-teal-accent ml-1" />
          )}
        </div>
      </div>

      {/* Right panel: findings dashboard */}
      <div className="w-full md:w-60 bg-[#0F0F0F] rounded-lg p-5 border border-neutral-800 flex flex-col justify-between items-center text-center">
        <div className="w-full flex flex-col items-center gap-2">
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">
            Security Score
          </span>
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="38" stroke="#262626" strokeWidth="5" fill="transparent" />
              <circle
                cx="48"
                cy="48"
                r="38"
                stroke="#14B8A6"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray="238"
                strokeDashoffset={238 - (238 * securityScore) / 100}
                className="transition-all duration-750 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col justify-center items-center">
              <span className="text-2xl font-bold font-manrope text-white">{securityScore}</span>
              <span className="text-[9px] text-neutral-400 font-mono">/100</span>
            </div>
          </div>
        </div>

        <div className="w-full mt-4 space-y-2 text-left">
          <div className="flex justify-between items-center border-b border-neutral-900 pb-1.5">
            <span className="text-[10px] text-neutral-400 font-mono">Issues:</span>
            <span className="text-[10px] text-white font-mono font-bold">{findings.length}</span>
          </div>
          <div className="space-y-1">
            {findings.map((f, i) => {
              let tagColor = "text-teal-accent bg-teal-accent/10 border-teal-accent/20";
              if (f.includes("Leak")) tagColor = "text-slate-400 bg-slate-900/50 border-slate-800";
              if (f.includes("Injection"))
                tagColor = "text-teal-accent bg-teal-accent/10 border-teal-accent/20";
              return (
                <div
                  key={i}
                  className={`text-[9px] border rounded px-1.5 py-0.5 font-mono flex items-center gap-1 ${tagColor}`}
                >
                  {f}
                </div>
              );
            })}
            {findings.length === 0 && (
              <div className="text-[9px] text-neutral-555 italic font-mono">Scans running...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("npx RaksHex scan ./collection.json");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const featureCards = [
    {
      title: "Security Scanner",
      description: "87-payload library. OWASP Top 10. PCI DSS v4.",
      link: "/features#security-scanner",
      icon: Shield,
      hoverClass: "hover-shield-pulse text-teal-accent",
    },
    {
      title: "Kill Switch",
      description: "Sub-second circuit breaker. Budget, anomaly, score.",
      link: "/features#kill-switch",
      icon: Power,
      hoverClass: "hover-power-glow text-neutral-400 hover:text-red-500",
    },
    {
      title: "Cost Monitor",
      description: "Holt-Winters forecasting. Per-model breakdown.",
      link: "/features#cost-monitor",
      icon: BarChart,
      hoverClass: "hover-graph-bounce text-teal-accent",
    },
    {
      title: "Thinking Tokens",
      description: "World-first reasoning isolation.",
      link: "/features#thinking-tokens",
      icon: Brain,
      hoverClass: "hover-brain-pulse text-teal-accent",
    },
    {
      title: "Shadow API",
      description: "Express, FastAPI, Flask, Django, Spring, Laravel.",
      link: "/features#shadow-api",
      icon: Ghost,
      hoverClass: "hover-ghost-fade text-teal-accent",
    },
    {
      title: "Credential Scanner",
      description: "AWS, GitHub, OpenAI, Stripe. Aadhaar + PAN.",
      link: "/features#credentials",
      icon: Key,
      hoverClass: "hover-key-rotate text-teal-accent",
    },
    {
      title: "Compliance Reports",
      description: "SOC2, PCI DSS, OWASP. Vanta/Drata ready.",
      link: "/features#compliance",
      icon: FileText,
      hoverClass: "hover-draw-check text-teal-accent",
    },
    {
      title: "MCP Governance",
      description: "Tool registry, risk scoring, agent allowlists.",
      link: "/features#mcp",
      icon: Network,
      hoverClass: "hover-connect-network text-teal-accent",
    },
  ];

  const faqs = [
    {
      question: "What is RaksHex?",
      answer:
        "RaksHex is India's first AI Runtime Governance platform. It scans API endpoints for security vulnerabilities, monitors LLM token costs, blocks prompt injection attacks, and generates compliance reports — all in one platform.",
    },
    {
      question: "What AI frameworks does RaksHex support?",
      answer:
        "OpenAI, Anthropic Claude, Google Gemini, Mistral, Cohere, AWS Bedrock, and any LLM accessed via standard API. We also support MCP tool calls.",
    },
    {
      question: "What security checks does RaksHex perform?",
      answer:
        "87-payload prompt injection library, BOLA/IDOR detection, credential scanning (AWS, GitHub, Stripe, Aadhaar, PAN), shadow API discovery, missing auth detection, PII exposure, and OWASP AI Top 10 mapping.",
    },
    {
      question: "Who should use RaksHex?",
      answer:
        "Any team building with AI agents, LLMs, or AI-powered APIs who needs security visibility, cost control, and compliance evidence.",
    },
    {
      question: "Is RaksHex open source?",
      answer:
        "Our OWASP AI Top 10 detection ruleset is being open sourced. The core platform is commercial. Join the waitlist for early access.",
    },
    {
      question: "How is RaksHex different from Snyk or Datadog?",
      answer:
        "Snyk does code scanning. Datadog does infrastructure monitoring. Neither does prompt injection blocking, thinking token attribution, or AI-specific compliance reporting. RaksHex does all three.",
    },
    {
      question: "What does the kill switch actually do?",
      answer:
        "It's an autonomous circuit breaker. When your LLM spend, anomaly score, or red-team result crosses a threshold, RaksHex automatically returns 402 responses to the agent, stopping runaway cost or attacks.",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden font-sans selection:bg-[#14B8A6] selection:text-black">
      {/* SECTION 3 & 4 — HERO SECTION & LOGOMARQUEE */}
      <HeroSection />

      {/* NEW — INSTALL SECTION */}
      <InstallSection />

      {/* NEW — HOW IT WORKS */}
      <HowItWorks />

      {/* SECTION 5 — PRODUCT FEATURE CARDS */}
      <section className="relative w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8" id="features">
        <FeatureCards />
      </section>

      {/* SECTION 6 — COMPARISON TABLE */}
      <BenchmarkSection />

      {/* SECTION 7 — FRAMEWORK SUPPORT */}
      <section
        className="relative w-full max-w-[1280px] mx-auto py-16 px-6 bg-transparent"
        id="supporting-frameworks"
      >
        <div className="flex flex-col items-center gap-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] font-mono">
            Secures Any Framework
          </p>
          <div className="relative w-full z-10 overflow-hidden">
            <div className="absolute left-0 top-0 w-16 h-full z-10 pointer-events-none bg-gradient-to-r from-[#0a0a0a] to-transparent" />
            <div className="absolute right-0 top-0 w-16 h-full z-10 pointer-events-none bg-gradient-to-l from-[#0a0a0a] to-transparent" />

            <div className="flex items-center gap-12 animate-logo-scroll w-max pr-12">
              {[
                "Next.js",
                "React",
                "FastAPI",
                "Express",
                "Django",
                "Flask",
                "Spring Boot",
                "Laravel",
                "Vue",
                "Svelte",
                "NestJS",
                "Nuxt",
              ].map((f, i) => (
                <div
                  key={i}
                  className="text-[#9CA3AF] hover:text-white font-mono text-sm tracking-wide font-medium transition-colors bg-[#1A1F2E] border border-[#14B8A6]/20 rounded-[6px] px-4 py-2 shrink-0 select-none"
                >
                  {f}
                </div>
              ))}
              {[
                "Next.js",
                "React",
                "FastAPI",
                "Express",
                "Django",
                "Flask",
                "Spring Boot",
                "Laravel",
                "Vue",
                "Svelte",
                "NestJS",
                "Nuxt",
              ].map((f, i) => (
                <div
                  key={`repeat-${i}`}
                  className="text-[#9CA3AF] hover:text-white font-mono text-sm tracking-wide font-medium transition-colors bg-[#1A1F2E] border border-[#14B8A6]/20 rounded-[6px] px-4 py-2 shrink-0 select-none"
                >
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8 — TIMELINE/CHANGELOG */}
      <ChangelogSection />

      {/* SECTION 9 — COMMUNITY SECTION */}
      <section className="w-full max-w-[1280px] mx-auto py-16 px-6 xl:px-8 flex flex-col items-center gap-6 bg-transparent">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl sm:text-[36px] font-bold font-sans text-white leading-tight tracking-[-0.02em]">
            Join our Community
          </h2>
          <div className="flex gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-transparent hover:bg-[#14B8A6]/10 text-white border-2 border-[#14B8A6] text-xs font-mono tracking-wider px-5 py-2.5 rounded-[6px] font-semibold hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.1)] transition-all duration-200 transform"
            >
              GitHub Discussions
            </a>
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#14B8A6] hover:bg-[#0D9488] text-white hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.2)] text-xs font-mono tracking-wider px-5 py-2.5 rounded-[6px] font-bold transition-all duration-200 transform"
            >
              Join Discord
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 11 — FAQ SECTION */}
      <section className="w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 bg-transparent" id="faq">
        <div className="flex flex-col lg:flex-row gap-12 max-w-5xl mx-auto items-start">
          {/* FAQ sidebar */}
          <div className="lg:w-1/3 flex flex-col gap-4 text-left">
            <h2 className="text-3xl sm:text-[36px] font-bold text-white font-sans leading-tight tracking-[-0.02em]">
              Frequently Asked Questions
            </h2>
            <p className="text-[#9CA3AF] text-sm sm:text-base leading-relaxed">
              Questions? We've got answers. If you don't find what you need, feel free to read our
              docs.
            </p>
            <Link
              className="inline-flex items-center gap-1.5 text-[#14B8A6] hover:text-[#0D9488] text-sm font-semibold transition-all mt-2"
              href="/docs"
            >
              or check out our Documentation
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Accordions */}
          <div className="w-full lg:w-2/3 rounded-lg bg-[#1A1F2E] border border-[#14B8A6]/20 divide-y divide-[#1A1F2E]/80 shadow-md">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-b border-[#1A1F2E]/80 last:border-b-0">
                <h3 className="flex">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className={`flex flex-1 items-center justify-between p-6 text-sm sm:text-base font-semibold font-sans text-white transition-all hover:text-[#14B8A6] cursor-pointer text-left gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-2 rounded ${openFaq === idx ? "text-[#14B8A6]" : ""}`}
                  >
                    <span>{faq.question}</span>
                    <ChevronRight
                      className={`h-5 w-5 shrink-0 transition-transform duration-300 ${openFaq === idx ? "rotate-90 text-[#14B8A6]" : "text-[#9CA3AF]"}`}
                    />
                  </button>
                </h3>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out text-[#9CA3AF] text-xs sm:text-sm leading-relaxed px-6 ${openFaq === idx ? "max-h-[300px] pb-6" : "max-h-0"}`}
                >
                  <p className="text-left whitespace-pre-line">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 11A — ASK AI SECTION */}
      <AskAISection />

      {/* SECTION 11B — REAL SOCIAL PROOF */}
      <section className="py-20 px-6 xl:px-8 max-w-[1280px] mx-auto bg-transparent">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Trusted by developers</h2>
          <p className="text-[#9CA3AF] text-sm">
            Real metrics from open-source distribution channels
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <a href="https://www.npmjs.com/package/rakshex" target="_blank" rel="noopener noreferrer">
            <img
              src="https://img.shields.io/npm/dm/rakshex?style=for-the-badge&logo=npm&color=14B8A6&labelColor=1A1F2E"
              alt="npm downloads"
              className="h-8"
            />
          </a>
          <a
            href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://img.shields.io/visual-studio-marketplace/i/rakshex.rakshex-vscode?style=for-the-badge&logo=visual-studio-code&color=14B8A6&labelColor=1A1F2E"
              alt="VS Code installs"
              className="h-8"
            />
          </a>
          <a
            href="https://github.com/Akshu1245/devpulse-complete-codebase"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://img.shields.io/github/stars/Akshu1245/devpulse-complete-codebase?style=for-the-badge&logo=github&color=14B8A6&labelColor=1A1F2E"
              alt="GitHub stars"
              className="h-8"
            />
          </a>
          <img
            src="https://img.shields.io/badge/license-MIT-14B8A6?style=for-the-badge&labelColor=1A1F2E"
            alt="MIT License"
            className="h-8"
          />
        </div>
      </section>

      {/* SECTION 12 — FINAL CTA SECTION */}
      <section
        className="w-full max-w-[1280px] mx-auto px-6 py-24 text-center bg-transparent"
        id="cta"
      >
        <div className="max-w-xl mx-auto flex flex-col items-center gap-8 bg-[#1A1F2E] border border-[#14B8A6]/20 p-8 sm:p-12 rounded-2xl shadow-md relative overflow-hidden group transition-all duration-300">
          <h2 className="text-3xl sm:text-[36px] font-bold font-sans text-white leading-[1.2] tracking-[-0.02em]">
            Ready to Secure Your AI Stack?
          </h2>
          <p className="text-[#9CA3AF] text-base leading-relaxed max-w-[480px] font-sans">
            Be among the first. Join the waitlist.
          </p>

          <div className="w-full z-10">
            <WaitlistForm />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center mt-2 border-t border-[#1A1F2E] pt-6 z-10">
            <Link
              href="#waitlist"
              className="text-[#14B8A6] hover:text-[#0D9488] font-semibold text-sm font-sans underline underline-offset-4 transition-colors"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 13 — FOOTER */}
      <Footer />
    </div>
  );
}
