"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useScrollReveal } from "@/lib/animations/scroll-reveal";
import { HeroSection } from "@/components/home/HeroSection";
import { FeatureCards } from "@/components/home/FeatureCards";
import { BenchmarkSection } from "@/components/home/BenchmarkSection";
import { ChangelogSection } from "@/components/home/ChangelogSection";
import { AskAISection } from "@/components/home/AskAISection";
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
    <article ref={containerRef} className="PlatformStatsShowcase_card__DyDV_">
      <p className="PlatformStatsShowcase_label__dAs7X">{label}</p>
      <div aria-label={targetValue} className="PlatformStatsShowcase_value__ypr4_">
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
      <div className="p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm font-mono text-center shadow-[0_0_15px_rgba(6,182,212,0.1)]">
        ✓ You have been added to the waitlist!
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
          className="flex-1 px-4 py-3 bg-neutral-900/90 border border-neutral-700 rounded focus:outline-none focus:border-cyan-500 text-white text-sm font-mono"
          disabled={joinMutation.isPending}
        />
        <button
          type="submit"
          disabled={joinMutation.isPending}
          className="bg-[#06b6d4] hover:bg-[#0891b2] text-black font-bold px-6 py-3 text-xs tracking-wider uppercase font-mono rounded disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0"
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
  const [securityScore, setSecurityScore] = useState(100);

  useEffect(() => {
    const steps = [
      { text: "> rakshex scan ./api.json", delay: 1200 },
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
    "> rakshex scan ./api.json",
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
          <span className="text-[10px] text-neutral-500 ml-2">bash - rakshex scan</span>
        </div>
        <div className="space-y-2 flex-1 overflow-y-auto">
          {terminalLines.slice(0, scanStep).map((line, idx) => {
            let color = "text-neutral-300";
            if (line.startsWith("✓")) color = "text-cyan-400";
            else if (line.startsWith("⚠")) color = "text-amber-400";
            else if (line.startsWith("🔒")) color = "text-red-400";
            else if (line.startsWith("💰")) color = "text-emerald-400";
            return (
              <p key={idx} className={`${color} font-mono leading-relaxed`}>
                {line}
              </p>
            );
          })}
          {scanStep < terminalLines.length && (
            <span className="inline-block w-1.5 h-3 bg-cyan-400 animate-pulse ml-1" />
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
                stroke="#06b6d4"
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
              let tagColor = "text-cyan-400 bg-cyan-950/20 border-cyan-800/30";
              if (f.includes("Leak"))
                tagColor = "text-amber-400 bg-amber-950/20 border-amber-800/30";
              if (f.includes("Injection"))
                tagColor = "text-red-400 bg-red-950/20 border-red-800/30";
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
              <div className="text-[9px] text-neutral-500 italic font-mono">Scans running...</div>
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
    navigator.clipboard.writeText("npx rakshex scan ./collection.json");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const featureCards = [
    {
      title: "Security Scanner",
      description: "87-payload library. OWASP Top 10. PCI DSS v4.",
      link: "/features#security-scanner",
      icon: Shield,
      hoverClass: "hover-shield-pulse text-cyan-400",
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
      hoverClass: "hover-graph-bounce text-cyan-400",
    },
    {
      title: "Thinking Tokens",
      description: "World-first reasoning isolation. Patent filed.",
      link: "/features#thinking-tokens",
      icon: Brain,
      hoverClass: "hover-brain-pulse text-cyan-400",
    },
    {
      title: "Shadow API",
      description: "Express, FastAPI, Flask, Django, Spring, Laravel.",
      link: "/features#shadow-api",
      icon: Ghost,
      hoverClass: "hover-ghost-fade text-cyan-400",
    },
    {
      title: "Credential Scanner",
      description: "AWS, GitHub, OpenAI, Stripe. Aadhaar + PAN.",
      link: "/features#credentials",
      icon: Key,
      hoverClass: "hover-key-rotate text-cyan-400",
    },
    {
      title: "Compliance Reports",
      description: "SOC2, PCI DSS, OWASP. Vanta/Drata ready.",
      link: "/features#compliance",
      icon: FileText,
      hoverClass: "hover-draw-check text-cyan-400",
    },
    {
      title: "MCP Governance",
      description: "Tool registry, risk scoring, agent allowlists.",
      link: "/features#mcp",
      icon: Network,
      hoverClass: "hover-connect-network text-cyan-400",
    },
  ];

  const tweets = [
    {
      handle: "@devesh_k_r",
      text: "@rakshexhq found a production OpenAI key in our test collection.\nOne that was about to go live. Not a drill.",
      date: "May 2026",
    },
    {
      handle: "@aarti_builds",
      text: "The @rakshexhq kill switch tripped automatically on a runaway agent loop.\nSaved us ~$8K. This feature alone is worth it.",
      date: "May 2026",
    },
    {
      handle: "@siddharth_swe",
      text: "SOC2 evidence prep used to be 3 days of pain.\n@rakshexhq generates the bundle in one click. Our auditor was genuinely confused.",
      date: "May 2026",
    },
    {
      handle: "@priya_appsec",
      text: "Thinking token attribution from @rakshexhq is wild. 40% of our Claude\nbill was reasoning tokens from a single misconfigured endpoint.",
      date: "April 2026",
    },
    {
      handle: "@nikhil_founder",
      text: "@rakshexhq in GitHub Actions is a no-brainer. Every PR gets security\nscore + cost delta in USD and INR. Team loves it.",
      date: "April 2026",
    },
    {
      handle: "@arjun_fintech",
      text: "Shadow API discovery found 7 forgotten endpoints. Two had zero auth.\n@rakshexhq is now mandatory before every release.",
      date: "April 2026",
    },
    {
      handle: "@meera_devops",
      text: "Deployed @rakshexhq in 4 minutes. Scanned 340 endpoints.\nFound a JWT secret we had no idea existed.",
      date: "March 2026",
    },
    {
      handle: "@rohan_ml",
      text: "The MCP governance layer from @rakshexhq is exactly what AI agent\nsecurity needed. Nothing else does this.",
      date: "March 2026",
    },
  ];

  const faqs = [
    {
      question: "What is RakshEx?",
      answer:
        "RakshEx is India's first AI Runtime Governance platform. It scans API endpoints for security vulnerabilities, monitors LLM token costs, blocks prompt injection attacks, and generates compliance reports — all in one platform.",
    },
    {
      question: "What AI frameworks does RakshEx support?",
      answer:
        "OpenAI, Anthropic Claude, Google Gemini, Mistral, Cohere, AWS Bedrock, and any LLM accessed via standard API. We also support MCP tool calls.",
    },
    {
      question: "What security checks does RakshEx perform?",
      answer:
        "87-payload prompt injection library, BOLA/IDOR detection, credential scanning (AWS, GitHub, Stripe, Aadhaar, PAN), shadow API discovery, missing auth detection, PII exposure, and OWASP AI Top 10 mapping.",
    },
    {
      question: "Who should use RakshEx?",
      answer:
        "Any team building with AI agents, LLMs, or AI-powered APIs who needs security visibility, cost control, and compliance evidence.",
    },
    {
      question: "Is RakshEx open source?",
      answer:
        "Our OWASP AI Top 10 detection ruleset is being open sourced. The core platform is commercial. Join the waitlist for early access.",
    },
    {
      question: "How is RakshEx different from Snyk or Datadog?",
      answer:
        "Snyk does code scanning. Datadog does infrastructure monitoring. Neither does prompt injection blocking, thinking token attribution, or AI-specific compliance reporting. RakshEx does all three.",
    },
    {
      question: "What does the kill switch actually do?",
      answer:
        "It's an autonomous circuit breaker. When your LLM spend, anomaly score, or red-team result crosses a threshold, RakshEx automatically returns 402 responses to the agent, stopping runaway cost or attacks.",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden font-manrope selection:bg-cyan-500 selection:text-black">
      {/* SECTION 3 — HERO SECTION & LOGOMARQUEE */}
      <HeroSection />

      {/* SECTION 4 — PRODUCT FEATURE CARDS */}
      <section className="relative w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8" id="features">
        <FeatureCards />
      </section>

      {/* SECTION 5 — BENCHMARK SECTION (Cloned "1.6x Faster" style) */}
      <BenchmarkSection />

      {/* SECTION 6 — FRAMEWORKS MARQUEE (logo support) */}
      <section
        className="relative w-full max-w-[1280px] mx-auto py-16 px-6"
        id="supporting-frameworks"
      >
        <div className="flex flex-col items-center gap-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500 font-mono">
            Secures Any Framework
          </p>
          <div className="relative w-full z-10 overflow-hidden">
            <div className="absolute left-0 top-0 w-16 h-full z-10 pointer-events-none bg-gradient-to-r from-[#0F0F0F] to-transparent" />
            <div className="absolute right-0 top-0 w-16 h-full z-10 pointer-events-none bg-gradient-to-l from-[#0F0F0F] to-transparent" />

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
                  className="text-neutral-400 hover:text-white font-mono text-sm tracking-wide font-medium transition-colors bg-neutral-900/60 border border-neutral-800 rounded-lg px-4 py-2 shrink-0 select-none"
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
                  className="text-neutral-400 hover:text-white font-mono text-sm tracking-wide font-medium transition-colors bg-neutral-900/60 border border-neutral-800 rounded-lg px-4 py-2 shrink-0 select-none"
                >
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 — CHANGELOG PREVIEW */}
      <ChangelogSection />

      {/* SECTION 8 — COMMUNITY SOCIAL PROOF (Twitter Card Masonry) */}
      <section className="w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-[28px] sm:text-[38px] font-bold font-manrope text-white leading-tight">
            Join our Community
          </h2>
          <div className="flex gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white text-xs font-mono tracking-wider px-5 py-2.5 rounded font-semibold transition-all"
            >
              GitHub Discussions
            </a>
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono tracking-wider px-5 py-2.5 rounded font-bold transition-all"
            >
              Join Discord
            </a>
          </div>
        </div>

        {/* Masonry Tweets layout */}
        <div className="columns-1 md:columns-2 xl:columns-3 gap-4 w-full max-w-6xl mx-auto space-y-4">
          {tweets.map((tw, idx) => (
            <div
              key={idx}
              className="break-inside-avoid bg-[#181818] border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors flex flex-col gap-4"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-cyan-950 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs uppercase">
                    {tw.handle.charAt(1)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white leading-none">{tw.handle}</p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{tw.date}</p>
                  </div>
                </div>
                <span className="text-neutral-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 whitespace-pre-line text-left leading-relaxed font-manrope">
                {tw.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 9 — FAQ SECTION */}
      <section className="w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8" id="faq">
        <div className="flex flex-col lg:flex-row gap-12 max-w-5xl mx-auto items-start">
          {/* FAQ sidebar */}
          <div className="lg:w-1/3 flex flex-col gap-4 text-left">
            <h2 className="text-[28px] sm:text-[36px] font-bold text-white font-manrope leading-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
              Questions? We've got answers. If you don't find what you need, feel free to read our
              docs.
            </p>
            <Link
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition-all mt-2"
              href="/docs"
            >
              or check out our Documentation
              <ArrowRight className="w-4 h-4 animate-pulse" />
            </Link>
          </div>

          {/* Accordions */}
          <div className="w-full lg:w-2/3 rounded-xl bg-[#181818] border border-neutral-800 divide-y divide-neutral-800 shadow-lg">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-b border-neutral-800 last:border-b-0">
                <h3 className="flex">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="flex flex-1 items-center justify-between p-6 text-sm sm:text-base font-semibold text-white transition-all hover:text-cyan-400 cursor-pointer text-left gap-4"
                  >
                    <span>{faq.question}</span>
                    <ChevronRight
                      className={`h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-300 ${openFaq === idx ? "rotate-90 text-cyan-400" : ""}`}
                    />
                  </button>
                </h3>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out text-neutral-400 text-xs sm:text-sm leading-relaxed px-6 ${openFaq === idx ? "max-h-[300px] pb-6" : "max-h-0"}`}
                >
                  <p className="text-left whitespace-pre-line">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 10 — ASK AI SECTION */}
      <AskAISection />

      {/* SECTION 11 — PLATFORM STATISTICS */}
      <section className="PlatformStatsShowcase_section__FNJKE">
        <h2 className="sr-only">Platform statistics</h2>
        <div className="PlatformStatsShowcase_grid__AIRBY">
          <StatsCard label="COLLECTIONS SCANNED" targetValue="12,847" />
          <StatsCard label="VULNERABILITIES FOUND" targetValue="94,231" />
          <StatsCard label="TOKENS SAVED" targetValue="2.4B" />
          <StatsCard label="ENGINEERS ON WAITLIST" targetValue="1,247" />
        </div>
      </section>

      {/* SECTION 12 — FINAL CTA SECTION */}
      <section className="w-full max-w-[1280px] mx-auto px-6 py-24 text-center" id="cta">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-8 bg-gradient-to-b from-[#181818] to-neutral-950 p-8 sm:p-12 border border-neutral-800 rounded-2xl shadow-xl">
          <h2 className="text-[28px] sm:text-[38px] font-bold font-manrope text-white leading-tight">
            Start Securing Your AI Agents
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Protect your reasoning tokens, stop prompt injections, discover shadow APIs, and export
            compliance data. Join the waitlist now.
          </p>

          <div className="w-full">
            <WaitlistForm />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-2 border-t border-neutral-900 pt-6">
            <Link
              href="/register"
              className="flex-1 text-center bg-cyan-500 hover:bg-cyan-400 text-black py-2.5 rounded font-bold text-xs uppercase tracking-wider font-mono shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              Try Free — No Credit Card
            </Link>
            <Link
              href="/demo"
              className="flex-1 text-center bg-neutral-900 hover:bg-neutral-850 text-white border border-neutral-800 py-2.5 rounded font-medium text-xs uppercase tracking-wider font-mono"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 13 — FOOTER */}
      <Footer />
    </div>
  );
}
