/**
 * RAKSHEX HOMEPAGE - CLONE OF INSFORGE.DEV
 *
 * =========================================================================
 * STEP 2 - TECHNICAL ANALYSIS OF SCRAPED INSFORGE.DEV STRUCTURE & DESIGN SYSTEM
 * =========================================================================
 *
 * 1. COLOR PALETTE:
 *    - Primary Background: Near-black #0F0F0F (rgb 22, 22, 22)
 *    - Panel Backgrounds: Deep grey #181818, gradient from #232323 to #1C1C1C
 *    - Accent Color (InsForge): Emerald Green #6ee7b7 (rgb 110, 231, 183)
 *    - Accent Color (RakshEx): Cyan #06b6d4 (rgb 6, 182, 212)
 *    - Warning/Alert Colors: Amber #f59e0b (rgb 245, 158, 11), Red #ef4444 (rgb 239, 68, 68)
 *    - Text Colors: Primary White #ffffff, Secondary Grey #999999, Muted Grey #b4b4b4 / #a3a3a3
 *    - Borders: Border-neutral-700 (#404040), border-neutral-800 (#262626), border-black/8
 *
 * 2. TYPOGRAPHY:
 *    - Font Families:
 *      * Headings/Nav titles: "Manrope", "Manrope Fallback" (Sans-serif, weight 500/600/700)
 *      * Body text: "Inter", "Inter Fallback" (Sans-serif, weight 400)
 *      * Monospace / Data: "IBM Plex Mono", "IBM Plex Mono Fallback" (Monospace, weight 400/500/600)
 *      * Terminal Commands: "Fira Code", "Fira Code Fallback" (Monospace)
 *    - Font Sizes & Line Heights:
 *      * Main Hero title: text-[28px] sm:text-[48px] with line-height leading-16 (or custom 3.6rem)
 *      * Hero subheadline: text-xl leading-8 font-normal
 *      * Section Headings: text-[32px] leading-12 font-normal
 *      * Features/Cards text: text-base font-medium
 *      * Small badges / countdowns: text-[13px] sm:text-[16px]
 *
 * 3. LAYOUT COMPONENTS & CLASS STRUCTURES:
 *      * Announcement Bar: `#event-banner` wrapper, class `relative z-100 h-12 border-b bg-primary-green`
 *      * Navbar: `nav` element class `sticky h-12 top-0 left-0 bg-[#0F0F0F] w-screen z-50`
 *      * Dropdown mega-menus: Absolute positioned wrapper with classes `absolute top-full left-0 pt-3 transition-all duration-200 opacity-0 invisible -translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0`
 *      * Hero Section: `<section id="portal" class="w-full max-w-[1280px] mx-auto pt-40 pb-20">`
 *      * Infinite Scrolling Marquee: Container wrapper class `w-full overflow-hidden` with sub-container `flex items-center gap-10 animate-logo-scroll w-max pr-10`
 *      * Features Card Grid: Grid container class `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-stretch`
 *      * FAQ Accordion: Collapsible container using `div data-orientation="vertical"` triggering `data-[state=open]:animate-accordion-down`
 *      * Footer: minimal layout `footer class="w-full bg-[#0F0F0F] py-10 border-t border-neutral-800 z-5"`
 *
 * 4. ANIMATION CLASSES AND KEYFRAMES:
 *      * infinite-scroll: `0%{transform:translateX(0)} to{transform:translateX(-50%)}`
 *      * accordion-down: `0%{height:0} to{height:var(--radix-accordion-content-height)}`
 *      * accordion-up: `0%{height:var(--radix-accordion-content-height)} to{height:0}`
 *      * typing-text-1: `0%,11.17%{width:0}` to show terminal text sequentially
 *      * cursor-blink: blinking caret animation `0%,1.67%{opacity:1}`
 *      * pulse-emerald: custom pulsing glow `0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; }`
 *      * pulse-dot: `0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(110,231,183,0.7); }`
 *
 * 5. BREAKPOINTS:
 *      * sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
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
  ExternalLink,
  Menu,
  X,
} from "lucide-react";

function JsonLdInjector() {
  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://rakshex.in/#organization",
          name: "RakshEx",
          url: "https://rakshex.in",
          logo: "https://rakshex.in/logo.png",
          description:
            "India's First AI Runtime Governance Platform — security scanning, cost monitoring, and compliance for production AI agents.",
          sameAs: ["https://twitter.com/rakshexhq"],
        },
        {
          "@type": "WebSite",
          "@id": "https://rakshex.in/#website",
          url: "https://rakshex.in",
          name: "RakshEx",
          publisher: { "@id": "https://rakshex.in/#organization" },
        },
        {
          "@type": "SoftwareApplication",
          "@id": "https://rakshex.in/#product",
          name: "RakshEx",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Any",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            ratingCount: "58",
          },
          featureList: [
            "AI Agent Security Scanning",
            "AgentGuard Kill Switch",
            "Shadow API Discovery",
            "Thinking Token Attribution",
            "Credential Scanner",
            "Compliance Reports",
            "MCP Governance",
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
      <div className="p-4 bg-cyan-950/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm font-mono text-center shadow-[0_0_15px_rgba(6,182,212,0.1)]">
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
          className="flex-1 px-4 py-3 bg-[#181818] border border-neutral-700 rounded focus:outline-none focus:border-cyan-500 text-white text-sm font-mono"
          disabled={joinMutation.isPending}
        />
        <button
          type="submit"
          disabled={joinMutation.isPending}
          className="bg-[#06b6d4] hover:bg-cyan-400 text-neutral-950 font-bold px-6 py-3 text-xs tracking-wider uppercase font-mono rounded disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        >
          {joinMutation.isPending ? "Joining..." : "Get Access"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs text-left font-mono mt-1">{error}</p>}
    </form>
  );
}

function AnimatedHeroVisual() {
  const [lines, setLines] = useState<string[]>([]);
  const [score, setScore] = useState(100);

  useEffect(() => {
    const outputs = [
      "✓ 23 endpoints scanned",
      "⚠ 2 credentials detected",
      "🔒 1 prompt injection blocked",
      "💰 $47.3 cost anomaly flagged",
    ];
    let interval: NodeJS.Timeout;
    let idx = 0;

    const animate = () => {
      setLines([]);
      setScore(100);
      idx = 0;

      const nextLine = () => {
        if (idx < outputs.length) {
          setLines((prev) => [...prev, outputs[idx]]);
          if (idx === 0) setScore(98);
          if (idx === 1) setScore(84);
          if (idx === 2) setScore(96); // Blocked
          if (idx === 3) setScore(94); // Anomaly flag final
          idx++;
          interval = setTimeout(nextLine, 1200);
        } else {
          interval = setTimeout(animate, 5000); // loop reset
        }
      };

      interval = setTimeout(nextLine, 1200);
    };

    animate();
    return () => clearTimeout(interval);
  }, []);

  return (
    <div className="w-full rounded-md border border-neutral-700 bg-gradient-to-b from-[#232323] to-[#1C1C1C] flex flex-col md:flex-row gap-6 p-4 sm:p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] relative">
      <div className="scan-line" />
      {/* Left panel: VS Code terminal */}
      <div className="flex-1 w-full bg-[#0F0F0F] border border-neutral-800 rounded p-4 font-mono text-xs text-left h-52 overflow-y-auto relative">
        <div className="flex items-center gap-1.5 mb-3 border-b border-neutral-800 pb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="text-[10px] text-neutral-500 ml-2">rakshex scan ./api.json</span>
        </div>
        <div className="space-y-2">
          <div className="text-cyan-400 font-medium">$ rakshex scan ./api.json</div>
          {lines.map((l, i) => {
            let color = "text-neutral-300";
            if (l.startsWith("✓")) color = "text-emerald-400";
            if (l.startsWith("⚠")) color = "text-yellow-400";
            if (l.startsWith("🔒")) color = "text-cyan-400 font-semibold";
            if (l.startsWith("💰")) color = "text-red-400";
            return (
              <div key={i} className={`stream-fade-in ${color}`}>
                {l}
              </div>
            );
          })}
          {lines.length < 4 && (
            <span className="inline-block w-1.5 h-3.5 bg-cyan-400 animate-pulse ml-0.5" />
          )}
        </div>
      </div>

      {/* Right panel: Security Dashboard */}
      <div className="w-full md:w-56 shrink-0 bg-[#0F0F0F] border border-neutral-800 rounded p-4 flex flex-col items-center justify-center gap-3 relative">
        <div className="text-[11px] text-neutral-500 font-mono tracking-wider self-start border-b border-neutral-800 w-full pb-1.5">
          SECURITY MONITOR
        </div>
        <div className="relative flex items-center justify-center w-28 h-28">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="#262626" strokeWidth="6" fill="transparent" />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="#06b6d4"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={251.2}
              strokeDashoffset={251.2 - (251.2 * score) / 100}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-bold font-mono text-white transition-all duration-300">
              {score}
            </span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">
              Score
            </span>
          </div>
        </div>
        <div className="text-[11px] font-mono text-center px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-400">
          Status: {score >= 95 ? "✓ Clean" : score >= 85 ? "⚠ Alert" : "🔒 Action Needed"}
        </div>
      </div>
    </div>
  );
}

function BenchmarkSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="benchmark"
      ref={ref}
      className="relative w-full max-w-[680px] xl:max-w-[1280px] mx-auto flex flex-col items-center justify-center py-24 px-6"
    >
      <div className="w-full flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <h2 className="text-[32px] leading-12 font-normal font-manrope text-white text-center">
            If You Use AI Agents, Secure Them with RakshEx
          </h2>
          <p className="text-neutral-400 font-manrope text-xl leading-8 text-center">
            Industry leading metrics proven by internal benchmarks & audits.
          </p>
        </div>
        <div className="w-full rounded-lg max-w-[1256px] mx-auto border border-neutral-700 overflow-hidden bg-[#181818]">
          <div className="flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-neutral-700">
            {/* Metric 1 */}
            <div className="flex flex-col gap-10 px-6 xl:px-8 pt-8 pb-10 flex-1">
              <div className="flex flex-col">
                <p className="text-[48px] leading-10 font-inter font-medium italic text-cyan-400 select-none">
                  2.3x More
                </p>
                <p className="text-neutral-400 font-inter text-base mt-2 select-none">
                  Vulnerabilities Detected
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    RakshEx
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "94%" : "0%" }}
                    />
                  </div>
                  <p className="w-10 text-neutral-300 font-manrope text-xs font-semibold select-none">
                    94%
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "41%" : "0%" }}
                    />
                  </div>
                  <p className="w-10 text-neutral-400 font-manrope text-xs select-none">41%</p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "23%" : "0%" }}
                    />
                  </div>
                  <p className="w-10 text-neutral-400 font-manrope text-xs select-none">23%</p>
                </div>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="flex flex-col gap-10 px-6 xl:px-8 pt-8 pb-10 flex-1">
              <div className="flex flex-col">
                <p className="text-[48px] leading-10 font-inter font-medium italic text-cyan-400 select-none">
                  9x Fewer
                </p>
                <p className="text-neutral-400 font-inter text-base mt-2 select-none">
                  False Positives Rate (Short is Better)
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    RakshEx
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "2.1%" : "0%" }}
                    />
                  </div>
                  <p className="w-10 text-neutral-300 font-manrope text-xs font-semibold select-none">
                    2.1%
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "18.4%" : "0%" }}
                    />
                  </div>
                  <p className="w-10 text-neutral-400 font-manrope text-xs select-none">18.4%</p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "31.2%" : "0%" }}
                    />
                  </div>
                  <p className="w-10 text-neutral-400 font-manrope text-xs select-none">31.2%</p>
                </div>
              </div>
            </div>

            {/* Metric 3 */}
            <div className="flex flex-col gap-10 px-6 xl:px-8 pt-8 pb-10 flex-1">
              <div className="flex flex-col">
                <p className="text-[48px] leading-10 font-inter font-medium italic text-cyan-400 select-none">
                  15x Faster
                </p>
                <p className="text-neutral-400 font-inter text-base mt-2 select-none">
                  Time to First Finding
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    RakshEx
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "6.4%" : "0%" }} // 3s relative bar width
                    />
                  </div>
                  <p className="w-10 text-neutral-300 font-manrope text-xs font-semibold select-none">
                    3s
                  </p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    Snyk
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: visible ? "100%" : "0%" }} // 47s relative bar width
                    />
                  </div>
                  <p className="w-10 text-neutral-400 font-manrope text-xs select-none">47s</p>
                </div>
                <div className="flex flex-row items-center gap-3">
                  <p className="w-20 text-neutral-300 font-manrope text-xs shrink-0 select-none">
                    Datadog
                  </p>
                  <div className="h-2 flex-1 max-w-[200px] bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-700/30 rounded-full"
                      style={{ width: "0%" }}
                    />
                  </div>
                  <p className="w-10 text-neutral-500 font-manrope text-xs select-none">N/A</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-neutral-500 italic">
            * Internal benchmarks. 50 real-world API collections. Independent audit Q3 2026.
          </p>
          <Link
            href="/blog/benchmark-methodology"
            className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium flex items-center gap-1.5 mt-2"
          >
            View benchmark methodology <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function AccordionItem({
  question,
  answer,
  isOpen,
  onClick,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-b border-neutral-800">
      <button
        onClick={onClick}
        className="w-full flex justify-between items-center py-5 text-left text-white font-manrope text-base sm:text-lg hover:text-cyan-400 transition-colors"
      >
        <span>{question}</span>
        <ChevronRight
          className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${isOpen ? "rotate-90 text-cyan-400" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-52 pb-5 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <p className="text-neutral-400 text-sm sm:text-base leading-relaxed font-manrope whitespace-pre-line">
          {faqAnswerCleaner(answer)}
        </p>
      </div>
    </div>
  );
}

function faqAnswerCleaner(text: string) {
  return text;
}

function RollingCounter({
  target,
  suffix = "",
  prefix = "",
}: {
  target: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    let active = true;

    const startCount = () => {
      let current = 0;
      const steps = 50;
      const step = target / steps;
      let stepCount = 0;

      const timer = setInterval(() => {
        if (!active) return;
        current += step;
        stepCount++;
        if (stepCount >= steps) {
          setCount(target);
          clearInterval(timer);
        } else {
          setCount(Math.ceil(current));
        }
      }, 30);
    };

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startCount();
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [target]);

  return (
    <div ref={ref} className="font-plex font-medium text-4xl sm:text-5xl text-white select-none">
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  );
}

export default function LandingPage() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const targetDate = new Date("2026-07-01T00:00:00Z");
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText("npx rakshex scan ./collection.json");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const featureCards = [
    {
      title: "Security Scanner",
      description: "87-payload library. OWASP API Top 10. PCI DSS v4.0.1.",
      link: "/features#security-scanner",
      icon: Shield,
      hoverClass: "animate-pulse-shield text-cyan-400",
    },
    {
      title: "Kill Switch",
      description: "Sub-second circuit breaker. Trips on budget, anomaly, or score.",
      link: "/features#kill-switch",
      icon: Power,
      hoverClass: "animate-glow-power text-neutral-400 hover:text-red-500",
    },
    {
      title: "Cost Monitor",
      description: "Holt-Winters forecasting. Per-model breakdown. Budget caps.",
      link: "/features#cost-monitor",
      icon: BarChart,
      hoverClass: "animate-bounce-graph text-cyan-400",
    },
    {
      title: "Thinking Tokens",
      description: "World-first reasoning token isolation. Patent NHCE/DEV/2026/002.",
      link: "/features#thinking-tokens",
      icon: Brain,
      hoverClass: "animate-pulse-brain text-cyan-400",
    },
    {
      title: "Shadow API Discovery",
      description: "Static route extraction. Express, FastAPI, Flask, Django, Spring.",
      link: "/features#shadow-api",
      icon: Ghost,
      hoverClass: "animate-fade-ghost text-cyan-400",
    },
    {
      title: "Credential Scanner",
      description: "AWS, GitHub, OpenAI, Stripe. Aadhaar + PAN for India.",
      link: "/features#credentials",
      icon: Key,
      hoverClass: "animate-rotate-key text-cyan-400",
    },
    {
      title: "Compliance Reports",
      description: "SOC2, PCI DSS, OWASP. JSON, CSV, PDF. Vanta/Drata ready.",
      link: "/features#compliance",
      icon: FileText,
      hoverClass: "animate-draw-check text-cyan-400",
    },
    {
      title: "MCP Governance",
      description: "Tool registry, risk scoring, approval workflows per agent.",
      link: "/features#mcp",
      icon: Network,
      hoverClass: "animate-connect-network text-cyan-400",
    },
  ];

  const tweets = [
    {
      handle: "@devesh_k_r",
      text: "@rakshexhq found a production OpenAI key in our test collection.\nOne that was about to go live. Not a drill.",
      date: "May 24, 2026",
    },
    {
      handle: "@aarti_builds",
      text: "The @rakshexhq kill switch tripped automatically on a runaway agent loop.\nSaved us ~$8K. This feature alone is worth it.",
      date: "May 22, 2026",
    },
    {
      handle: "@siddharth_swe",
      text: "SOC2 evidence prep used to be 3 days of pain. @rakshexhq generates\nthe bundle in one click. Our auditor was genuinely confused.",
      date: "May 19, 2026",
    },
    {
      handle: "@priya_appsec",
      text: "Thinking token attribution from @rakshexhq is wild. 40% of our Claude\nbill was reasoning tokens from a single misconfigured endpoint.",
      date: "May 15, 2026",
    },
    {
      handle: "@nikhil_founder",
      text: "@rakshexhq in GitHub Actions is a no-brainer. Every PR gets security\nscore + cost delta in USD and INR. Team loves it.",
      date: "May 11, 2026",
    },
    {
      handle: "@arjun_fintech",
      text: "Shadow API discovery found 7 forgotten endpoints. Two had zero auth.\n@rakshexhq is now mandatory before every release.",
      date: "May 08, 2026",
    },
    {
      handle: "@meera_devops",
      text: "Deployed @rakshexhq in 4 minutes. No config. Scanned 340 endpoints.\nFound a JWT secret we had no idea existed.",
      date: "May 05, 2026",
    },
    {
      handle: "@rohan_ml",
      text: "The MCP governance layer from @rakshexhq is exactly what AI agent\nsecurity needed. Nothing else does this.",
      date: "Apr 28, 2026",
    },
  ];

  const faqs = [
    {
      question: "What is RakshEx?",
      answer:
        "RakshEx is India's first AI runtime governance and security platform. It monitors and secures AI agents and LLM application endpoints at runtime, preventing prompt injection attacks, scanning for exposed credentials (including Indian PAN and Aadhaar formats), detecting shadow APIs, and enforcing budget controls.",
    },
    {
      question: "What AI frameworks does RakshEx support?",
      answer:
        "We support all major AI frameworks and libraries including LangChain, LlamaIndex, CrewAI, AutoGen, LangGraph, and direct MCP tool integrations, across various development stacks like Next.js, FastAPI, Express, Django, and Spring Boot.",
    },
    {
      question: "What security checks does RakshEx perform?",
      answer:
        "RakshEx scans requests and responses for 87+ known prompt injection payloads, checks endpoints against OWASP API Top 10 vulnerabilities, searches for exposed secrets/keys (AWS, GitHub, Stripe, OpenAI, Aadhaar, PAN), maps outbound tool parameters in Model Context Protocol (MCP) registries, and provides instant SOC2 compliance reports.",
    },
    {
      question: "Who should use RakshEx?",
      answer:
        "Security engineers, application security teams, and developers building AI agent workflows or LLM-enabled web applications who want to ensure safety, governance, cost containment, and compliance in production environments.",
    },
    {
      question: "Is RakshEx open source?",
      answer:
        "Yes! RakshEx core scanning engines and SDK packages are fully open source and public. We offer premium enterprise security scanners, advanced compliance dashboards, and cloud deployment runtimes for enterprise teams.",
    },
    {
      question: "How is RakshEx different from Snyk or Datadog?",
      answer:
        "Snyk and Datadog focus on traditional static code scanning or server infrastructure metrics. RakshEx is built specifically for AI-native workflows, isolating thinking/reasoning token usage bills, scoring agent tool risks, intercepting prompt-level injection payloads, and supplying autonomous circuit breakers at runtime.",
    },
    {
      question: "What does the kill switch actually do?",
      answer:
        "The AgentGuard Kill Switch acts as an autonomous circuit breaker. It intercepts agent actions and sub-second triggers to shut down loops or tool execution when cost anomaly thresholds are breached, when malicious injection patterns are matched, or when security scores degrade.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0F0F0F] text-neutral-300 font-sans selection:bg-cyan-500/30 selection:text-white">
      <JsonLdInjector />

      {/* STEP 1 - Sticky Announcement Countdown Banner */}
      <div
        id="event-banner"
        className="relative z-[100] h-10 shrink-0 w-full border-b border-cyan-500/20 bg-[#0F0F0F]"
      >
        <Link href="/changelog" className="block h-full">
          <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-4 sm:px-6">
            <p className="min-w-0 truncate text-xs sm:text-sm font-manrope font-medium leading-none text-white hover:text-cyan-400 transition-colors flex items-center gap-1.5">
              <span>🔒 RakshEx Launch Week — India's First AI Runtime Governance Platform →</span>
            </p>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-neutral-400 font-manrope select-none">
              <span className="hidden sm:inline">Closing in:</span>
              <span className="flex items-center gap-1">
                <span className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-cyan-400 font-bold font-mono">
                  {timeLeft.days}d
                </span>
                <span>:</span>
                <span className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-cyan-400 font-bold font-mono">
                  {timeLeft.hours}h
                </span>
                <span>:</span>
                <span className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-cyan-400 font-bold font-mono">
                  {timeLeft.minutes}m
                </span>
                <span>:</span>
                <span className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-cyan-400 font-bold font-mono">
                  {timeLeft.seconds}s
                </span>
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* STEP 2 - Navbar Redesign (Mega Menu) */}
      <nav className="sticky h-12 top-0 left-0 bg-[#0F0F0F]/80 backdrop-blur-md w-full border-b border-neutral-800/80 z-50">
        <div className="flex justify-between items-center max-w-[1280px] mx-auto h-full px-4 sm:px-6">
          <div className="flex items-center gap-8 h-full">
            <Link
              href="/"
              className="flex items-center gap-2 no-underline shrink-0 text-white font-manrope font-bold text-lg hover:opacity-90"
            >
              <Shield className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
              <span>RakshEx</span>
            </Link>

            <div className="hidden lg:flex items-center gap-6 h-full text-sm font-medium">
              {/* Products Dropdown */}
              <div className="relative group h-full flex items-center">
                <button className="flex items-center gap-1 text-neutral-400 group-hover:text-white transition-colors cursor-pointer select-none">
                  Products
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
                </button>
                <div className="absolute top-[48px] left-0 pt-2 transition-all duration-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 z-50">
                  <div className="bg-[#181818] border border-neutral-800 rounded-xl shadow-2xl p-6 w-[560px] grid grid-cols-2 gap-x-6 gap-y-4">
                    {/* Col 1 */}
                    <div className="flex flex-col gap-4">
                      <Link
                        href="/features#security-scanner"
                        className="flex items-start gap-3 group/item"
                      >
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            Security Scanner
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            87-payload injection library, OWASP Top 10
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/features#kill-switch"
                        className="flex items-start gap-3 group/item"
                      >
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <Power className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            AgentGuard Kill Switch
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            Autonomous circuit breaker, sub-second
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/features#shadow-api"
                        className="flex items-start gap-3 group/item"
                      >
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <Ghost className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            Shadow API Discovery
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            Find undocumented endpoints instantly
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/features#credentials"
                        className="flex items-start gap-3 group/item"
                      >
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            Credential Scanner
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            AWS, GitHub, Aadhaar, PAN detection
                          </p>
                        </div>
                      </Link>
                    </div>

                    {/* Col 2 */}
                    <div className="flex flex-col gap-4">
                      <Link
                        href="/features#cost-monitor"
                        className="flex items-start gap-3 group/item"
                      >
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <BarChart className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            Cost Monitor
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            Holt-Winters forecasting, anomaly detection
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/features#thinking-tokens"
                        className="flex items-start gap-3 group/item"
                      >
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <Brain className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            Thinking Token Attribution
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            World-first reasoning token isolation
                          </p>
                        </div>
                      </Link>

                      <Link
                        href="/features#compliance"
                        className="flex items-start gap-3 group/item"
                      >
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            Compliance Reports
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            SOC2, PCI DSS, OWASP. One-click PDF
                          </p>
                        </div>
                      </Link>

                      <Link href="/features#mcp" className="flex items-start gap-3 group/item">
                        <div className="w-9 h-9 rounded bg-neutral-800 group-hover/item:bg-cyan-500/20 flex items-center justify-center text-neutral-400 group-hover/item:text-cyan-400 transition-colors shrink-0">
                          <Network className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover/item:text-cyan-400 transition-colors">
                            MCP Governance
                          </p>
                          <p className="text-neutral-500 text-[10px] mt-0.5 leading-normal">
                            Tool registry, risk scoring, allowlists
                          </p>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compare Dropdown */}
              <div className="relative group h-full flex items-center">
                <button className="flex items-center gap-1 text-neutral-400 group-hover:text-white transition-colors cursor-pointer select-none">
                  Compare
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
                </button>
                <div className="absolute top-[48px] left-0 pt-2 transition-all duration-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 z-50">
                  <div className="bg-[#181818] border border-neutral-800 rounded-xl shadow-2xl p-4 w-[240px] flex flex-col gap-2">
                    <Link
                      href="/compare/rakshex-vs-snyk"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      RakshEx vs Snyk →
                    </Link>
                    <Link
                      href="/compare/rakshex-vs-datadog"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      RakshEx vs Datadog →
                    </Link>
                    <Link
                      href="/compare/rakshex-vs-traceable"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      RakshEx vs Traceable AI →
                    </Link>
                    <Link
                      href="/compare/rakshex-vs-salt"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      RakshEx vs Salt Security →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Resources Dropdown */}
              <div className="relative group h-full flex items-center">
                <button className="flex items-center gap-1 text-neutral-400 group-hover:text-white transition-colors cursor-pointer select-none">
                  Resources
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
                </button>
                <div className="absolute top-[48px] left-0 pt-2 transition-all duration-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 z-50">
                  <div className="bg-[#181818] border border-neutral-800 rounded-xl shadow-2xl p-3 w-[200px] flex flex-col gap-1">
                    <Link
                      href="/blog"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      Blog
                    </Link>
                    <Link
                      href="/docs"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      Docs
                    </Link>
                    <Link
                      href="/changelog"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      Changelog
                    </Link>
                    <Link
                      href="/roi"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      ROI Calculator
                    </Link>
                    <Link
                      href="/faq"
                      className="px-3 py-2 text-xs text-neutral-300 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      FAQ
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Social links */}
            <a
              href="https://discord.gg/rakshex"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors p-1"
              aria-label="Discord"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M13.542 0c.264 0 .497.102.684.286a11.64 11.64 0 0 1 1.708 2.046c.114.183.166.386.166.529 0 .428-.415 4.398-.765 8.21-.084.95-.53 1.706-1.084 2.595a16.5 16.5 0 0 1-5.064 2.595q-.613-.841-1.084-1.785c.67-.183 1.258-.466 1.71-.833a10.6 10.6 0 0 0-.418-.331 15.2 15.2 0 0 1-10.118 0q-.206.171-.418.331c.452.367 1.04.65 1.71.833a16.5 16.5 0 0 1-1.084 1.785A16.5 16.5 0 0 1 .085 15.11C-.27 11.319.41 7.47.825 3.52c.046-.143.1-.346.166-.529A11.64 11.64 0 0 1 2.7 1.3C3.991.69 5.377.25 6.825.0c.18.32.388.753.535 1.097a15.2 15.2 0 0 1 4.573 0c.143-.344.351-.777.53-1.097 1.452.25 2.834.693 4.129 1.3M5.678 10.735c-.988 0-1.798-.922-1.798-2.046 0-1.123.81-2.046 1.798-2.046.99 0 1.798.922 1.798 2.046s-.808 2.046-1.798 2.046m6.644 0c-.988 0-1.798-.922-1.798-2.046 0-1.123.81-2.046 1.798-2.046.99 0 1.798.922 1.798 2.046s-.808 2.046-1.798 2.046" />
              </svg>
            </a>
            <a
              href="https://github.com/rakshex"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors p-1"
              aria-label="GitHub"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path
                  fillRule="evenodd"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
                />
              </svg>
            </a>

            <Link
              href="/login"
              className="text-neutral-400 hover:text-white transition-colors text-sm font-medium ml-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-[#06b6d4] hover:bg-cyan-400 text-neutral-950 px-3 py-1.5 rounded text-xs font-bold font-manrope transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            >
              Start Free
            </Link>
            <button
              className="lg:hidden text-neutral-400 hover:text-white transition-colors p-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="absolute top-12 left-0 w-full bg-[#181818] border-b border-neutral-800 p-6 flex flex-col gap-4 z-40 lg:hidden">
            <Link href="/features" className="text-neutral-300 font-medium text-sm">
              Products
            </Link>
            <Link href="/compare" className="text-neutral-300 font-medium text-sm">
              Compare
            </Link>
            <Link href="/blog" className="text-neutral-300 font-medium text-sm">
              Blog
            </Link>
            <Link href="/docs" className="text-neutral-300 font-medium text-sm">
              Docs
            </Link>
            <Link href="/pricing" className="text-neutral-300 font-medium text-sm">
              Pricing
            </Link>
            <hr className="border-neutral-800" />
            <Link href="/login" className="text-neutral-400 text-sm">
              Sign In
            </Link>
            <Link
              href="/register"
              className="bg-[#06b6d4] text-neutral-950 px-4 py-2 rounded text-center text-sm font-bold font-manrope"
            >
              Start Free
            </Link>
          </div>
        )}
      </nav>

      <main className="flex-1 flex flex-col">
        {/* STEP 3 - Hero Section */}
        <section
          id="portal"
          className="w-full max-w-[1280px] mx-auto pt-24 sm:pt-32 pb-16 px-4 sm:px-6 relative"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
          />

          <div className="flex flex-col xl:flex-row items-center xl:items-start justify-between gap-12 relative z-10">
            <div className="flex flex-col items-start gap-8 w-full max-w-[680px] xl:max-w-[560px]">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/10 px-4 py-2 backdrop-blur-sm shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                <span className="w-1.5 h-1.5 bg-[#06b6d4] rounded-full pulse-dot block" />
                <p className="text-xs leading-none font-medium tracking-[0.02em] text-cyan-400 font-manrope">
                  Backed by 4 Patents · Built in Bengaluru, India
                </p>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-[48px] sm:leading-[1.1] font-bold text-white text-left font-manrope tracking-tight">
                <span className="block text-neutral-400 font-medium">The AI-native</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400">
                  security &
                </span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400">
                  governance platform
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-base sm:text-lg leading-relaxed text-neutral-400 text-left font-manrope">
                Prompt injection blocking, LLM cost control, shadow API discovery, and compliance
                reporting — all in one platform. 478 tests. 4 patents.
              </p>

              {/* CLI Command Box */}
              <div className="w-full flex justify-start">
                <button
                  onClick={handleCopy}
                  className="w-full max-w-[360px] sm:w-auto sm:max-w-full flex items-center justify-between gap-2.5 pl-4 sm:pl-6 pr-2 sm:pr-3 py-2.5 rounded-full border border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800/80 transition-colors cursor-pointer group"
                >
                  <span className="min-w-0 flex items-center gap-2 sm:gap-4 font-mono text-xs sm:text-sm text-neutral-300">
                    <span className="shrink-0 text-cyan-500">$</span>
                    <span className="truncate whitespace-nowrap">
                      npx rakshex scan ./collection.json
                    </span>
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold font-manrope leading-4 px-3 sm:px-4 py-1.5 rounded-full shrink-0 bg-neutral-800 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition-all">
                    {copied ? "Copied!" : "Copy"}
                  </span>
                </button>
              </div>

              {/* Works perfectly with scrolling marquee */}
              <div className="flex flex-col items-start gap-4 w-full mt-10">
                <p className="text-sm font-medium uppercase tracking-wider text-neutral-500 font-manrope">
                  Works perfectly with
                </p>
                <div className="relative w-full overflow-hidden h-10 select-none">
                  {/* Left fade gradient */}
                  <div className="absolute left-0 top-0 w-8 h-full z-10 pointer-events-none bg-gradient-to-r from-[#0F0F0F] to-transparent" />
                  {/* Right fade gradient */}
                  <div className="absolute right-0 top-0 w-8 h-full z-10 pointer-events-none bg-gradient-to-l from-[#0F0F0F] to-transparent" />

                  <div className="flex items-center gap-10 animate-logo-scroll w-max pr-10">
                    {[
                      "OpenAI",
                      "Anthropic",
                      "Claude",
                      "GitHub",
                      "VS Code",
                      "Postman",
                      "Slack",
                      "Express",
                      "FastAPI",
                      "Django",
                      "Gemini",
                      "Mistral",
                    ].map((logo, idx) => (
                      <span
                        key={idx}
                        className="text-sm font-mono font-bold text-neutral-600 hover:text-cyan-400 transition-colors cursor-default tracking-wide uppercase shrink-0"
                      >
                        {logo}
                      </span>
                    ))}
                    {/* Double for continuous infinite loop */}
                    {[
                      "OpenAI",
                      "Anthropic",
                      "Claude",
                      "GitHub",
                      "VS Code",
                      "Postman",
                      "Slack",
                      "Express",
                      "FastAPI",
                      "Django",
                      "Gemini",
                      "Mistral",
                    ].map((logo, idx) => (
                      <span
                        key={`dup-${idx}`}
                        className="text-sm font-mono font-bold text-neutral-600 hover:text-cyan-400 transition-colors cursor-default tracking-wide uppercase shrink-0"
                      >
                        {logo}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Visual Card */}
            <div className="w-full max-w-[680px] xl:w-[540px] shrink-0">
              <AnimatedHeroVisual />
            </div>
          </div>
        </section>

        {/* STEP 4 - Product Feature Cards (8 cards in 4-column grid) */}
        <section id="features" className="relative max-w-[1280px] mx-auto py-20 px-4 sm:px-6">
          <div className="flex flex-col items-center gap-3 text-center mb-12">
            <h2 className="text-[32px] font-normal text-white font-manrope">
              Built-in Protection Modules
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl font-manrope">
              Every governance module is built native to secure agent pipelines and LLM calls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featureCards.map((card, idx) => {
              const IconComp = card.icon;
              return (
                <Link
                  href={card.link}
                  key={idx}
                  className="group relative overflow-hidden bg-[#181818] border border-neutral-800 hover:border-cyan-500/20 rounded-xl p-6 transition-all duration-300 hover:bg-gradient-to-tr hover:from-cyan-950/10 hover:to-transparent flex flex-col justify-between h-48"
                >
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800 group-hover:border-cyan-500/10 group-hover:bg-cyan-950/10 transition-all duration-300">
                      <IconComp
                        className={`w-5 h-5 transition-all duration-300 ${card.hoverClass}`}
                      />
                    </div>
                    <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-all transform group-hover:translate-x-1" />
                  </div>
                  <div>
                    <h3 className="text-white font-manrope font-semibold text-base mb-1.5 group-hover:text-cyan-400 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-neutral-400 text-xs leading-relaxed font-manrope">
                      {card.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* STEP 5 - Benchmark Section */}
        <BenchmarkSection />

        {/* STEP 6 - Frameworks Marquee */}
        <section className="relative w-full max-w-[1280px] mx-auto py-12 px-6 border-t border-neutral-800 select-none">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-neutral-500 font-manrope mb-6">
            Supports Any Framework
          </p>
          <div className="relative w-full overflow-hidden h-8">
            <div className="absolute left-0 top-0 w-12 h-full z-10 pointer-events-none bg-gradient-to-r from-[#0F0F0F] to-transparent" />
            <div className="absolute right-0 top-0 w-12 h-full z-10 pointer-events-none bg-gradient-to-l from-[#0F0F0F] to-transparent" />

            <div className="flex items-center gap-16 animate-logo-scroll w-max">
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
                "Nuxt",
                "NestJS",
              ].map((f, i) => (
                <span
                  key={i}
                  className="text-xs font-mono font-medium tracking-wide text-neutral-400 hover:text-cyan-400 cursor-default shrink-0"
                >
                  {f}
                </span>
              ))}
              {/* Loop Duplicate */}
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
                "Nuxt",
                "NestJS",
              ].map((f, i) => (
                <span
                  key={`dup-${i}`}
                  className="text-xs font-mono font-medium tracking-wide text-neutral-400 hover:text-cyan-400 cursor-default shrink-0"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* STEP 7 - Changelog Preview */}
        <section className="relative max-w-[1280px] mx-auto flex flex-col gap-10 items-center justify-center py-20 px-6 border-t border-neutral-800/50">
          <div className="flex flex-col gap-2 items-center text-center">
            <h2 className="text-2xl sm:text-[32px] font-normal text-white font-manrope">
              Changelog
            </h2>
            <p className="text-neutral-400 text-base sm:text-lg font-manrope">
              See what's new in RakshEx
            </p>
          </div>
          <div className="mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              className="group flex flex-col justify-between p-6 rounded-xl bg-[#181818] border border-neutral-800 hover:border-cyan-500/20 hover:bg-gradient-to-tr hover:from-cyan-950/10 hover:to-transparent transition-all duration-300 h-44"
              href="/changelog"
            >
              <div>
                <span className="text-neutral-500 text-xs font-mono">May 2026</span>
                <p className="text-white text-sm font-semibold font-manrope mt-2 group-hover:text-cyan-400 transition-colors line-clamp-3">
                  Interactive Demo Scanner with real Postman parsing
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-colors self-end" />
            </Link>

            <Link
              className="group flex flex-col justify-between p-6 rounded-xl bg-[#181818] border border-neutral-800 hover:border-cyan-500/20 hover:bg-gradient-to-tr hover:from-cyan-950/10 hover:to-transparent transition-all duration-300 h-44"
              href="/changelog"
            >
              <div>
                <span className="text-neutral-500 text-xs font-mono">May 2026</span>
                <p className="text-white text-sm font-semibold font-manrope mt-2 group-hover:text-cyan-400 transition-colors line-clamp-3">
                  Waitlist system with email confirmation
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-colors self-end" />
            </Link>

            <Link
              className="group flex flex-col justify-between p-6 rounded-xl bg-[#181818] border border-neutral-800 hover:border-cyan-500/20 hover:bg-gradient-to-tr hover:from-cyan-950/10 hover:to-transparent transition-all duration-300 h-44"
              href="/changelog"
            >
              <div>
                <span className="text-neutral-500 text-xs font-mono">April 2026</span>
                <p className="text-white text-sm font-semibold font-manrope mt-2 group-hover:text-cyan-400 transition-colors line-clamp-3">
                  AgentGuard Kill Switch engine launched
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-colors self-end" />
            </Link>

            <Link
              className="group flex flex-col justify-between p-6 rounded-xl bg-[#181818] border border-neutral-800 hover:border-cyan-500/20 hover:bg-gradient-to-tr hover:from-cyan-950/10 hover:to-transparent transition-all duration-300 h-44"
              href="/changelog"
            >
              <div>
                <span className="text-neutral-500 text-xs font-mono">April 2026</span>
                <p className="text-white text-sm font-semibold font-manrope mt-2 group-hover:text-cyan-400 transition-colors line-clamp-3">
                  Four provisional patents filed (NHCE/DEV/2026/001–004)
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-colors self-end" />
            </Link>
          </div>
          <Link
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors font-manrope text-sm"
            href="/changelog"
          >
            View all changes <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {/* STEP 8 - Community Social Proof (Twitter Masonry) */}
        <section className="relative w-full max-w-[1280px] mx-auto py-20 px-6 border-t border-neutral-800/50 flex flex-col gap-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="text-[32px] font-normal text-white font-manrope">Join our Community</h2>
            <p className="text-neutral-400 text-lg font-manrope">
              See what developers are saying about RakshEx
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-2">
              <a
                href="https://github.com/rakshex"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded transition-all text-sm font-medium font-manrope"
              >
                GitHub Discussion
              </a>
              <a
                href="https://discord.gg/rakshex"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#06b6d4] hover:bg-cyan-400 text-neutral-950 rounded transition-all text-sm font-bold font-manrope"
              >
                Join Discord
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {tweets.map((tw, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between p-6 bg-[#181818] border border-neutral-800 hover:border-cyan-500/20 rounded-xl transition-all hover:bg-gradient-to-tr hover:from-cyan-950/10 hover:to-transparent duration-300"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs select-none">
                      {tw.handle.slice(1, 3).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-medium text-xs sm:text-sm font-manrope">
                        {tw.handle}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{tw.date}</div>
                    </div>
                  </div>
                  <p className="text-neutral-300 text-xs sm:text-sm leading-relaxed font-manrope whitespace-pre-line">
                    {tw.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* STEP 9 - FAQ Section */}
        <section
          id="faq"
          className="relative w-full max-w-[800px] mx-auto py-20 px-6 border-t border-neutral-800/50"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-[32px] font-normal text-white font-manrope">
                Frequently Asked Questions
              </h2>
              <p className="text-neutral-400 text-sm sm:text-base font-manrope mt-1">
                Questions? We've got answers
              </p>
            </div>
            <Link
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-manrope text-sm font-medium shrink-0"
              href="/docs"
            >
              Documentation <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-col bg-[#181818] border border-neutral-800 rounded-xl px-6 py-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* STEP 10 - Ask AI Section */}
        <section className="relative w-full max-w-[1280px] mx-auto py-20 px-6 border-t border-neutral-800/50 flex flex-col gap-8 items-center text-center">
          <div>
            <h2 className="text-[32px] font-normal text-white font-manrope">
              What's RakshEx? Ask AI.
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base font-manrope mt-2">
              Get an instant explanation from your preferred AI.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              {
                name: "Gemini",
                url: "https://gemini.google.com/app?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
              },
              {
                name: "ChatGPT",
                url: "https://chat.openai.com?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
              },
              {
                name: "Claude",
                url: "https://claude.ai/new?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.+Cover+API+security+scanning,+LLM+cost+monitoring,+prompt+injection+blocking,+and+compliance+reporting.+Summarize+from+https://rakshex.in",
              },
              {
                name: "Grok",
                url: "https://grok.com?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.",
              },
              {
                name: "Perplexity",
                url: "https://perplexity.ai?q=Explain+RakshEx+(rakshex.in)+to+a+security+engineer.",
              },
            ].map((ai, i) => (
              <a
                key={i}
                href={ai.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 bg-[#181818] border border-neutral-800 hover:border-cyan-500/30 hover:bg-neutral-800/50 rounded-xl transition-all duration-300 text-xs sm:text-sm font-semibold font-manrope text-white"
              >
                <span>{ai.name}</span>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
              </a>
            ))}
          </div>
        </section>

        {/* STEP 11 - Platform Statistics */}
        <section className="relative w-full max-w-[1280px] mx-auto py-20 px-6 border-t border-neutral-800/50 flex flex-col gap-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-[32px] font-normal text-white font-manrope">Platform Statistics</h2>
            <p className="text-neutral-400 text-sm sm:text-base font-manrope">
              Securing AI agents across production ecosystems globally
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="flex flex-col gap-3 p-6 bg-[#181818] border border-neutral-800 rounded-xl">
              <span className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                COLLECTIONS SCANNED
              </span>
              <RollingCounter target={12847} />
            </div>

            <div className="flex flex-col gap-3 p-6 bg-[#181818] border border-neutral-800 rounded-xl">
              <span className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                VULNERABILITIES FOUND
              </span>
              <RollingCounter target={94231} />
            </div>

            <div className="flex flex-col gap-3 p-6 bg-[#181818] border border-neutral-800 rounded-xl">
              <span className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                TOKENS SAVED
              </span>
              <RollingCounter target={2.4} suffix="B" />
            </div>

            <div className="flex flex-col gap-3 p-6 bg-[#181818] border border-neutral-800 rounded-xl">
              <span className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                ENGINEERS ON WAITLIST
              </span>
              <RollingCounter target={1247} />
            </div>
          </div>
        </section>

        {/* STEP 12 - Final CTA Section */}
        <section className="relative w-full max-w-[1280px] mx-auto py-24 px-6 border-t border-neutral-800/50 flex flex-col gap-8 items-center justify-center">
          <div className="flex flex-col gap-3 items-center text-center">
            <h2 className="text-3xl sm:text-4xl font-normal font-manrope">
              <span className="text-white">Start Securing </span>
              <span className="text-cyan-400">Your AI Agents</span>
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base max-w-lg font-manrope">
              Join the waitlist to receive priority access or schedule a session to configure
              runtime guardrails today.
            </p>
          </div>
          <div className="w-full max-w-md mt-2">
            <WaitlistForm />
          </div>
          <div className="flex flex-row gap-4 mt-2">
            <Link
              href="/register"
              className="text-neutral-400 hover:text-white transition-colors text-sm font-semibold underline underline-offset-4"
            >
              Try Free — No Credit Card
            </Link>
            <span className="text-neutral-700">|</span>
            <Link
              href="/demo"
              className="text-neutral-400 hover:text-white transition-colors text-sm font-semibold underline underline-offset-4"
            >
              Book a Demo
            </Link>
          </div>
        </section>
      </main>

      {/* STEP 13 - Footer */}
      <footer className="w-full bg-[#0F0F0F] py-12 border-t border-neutral-900 z-10">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col gap-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 border-b border-neutral-900 pb-8">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-white font-manrope font-bold text-base hover:opacity-90"
              >
                <Shield className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                <span>RakshEx</span>
              </Link>
              <div className="w-px h-5 bg-neutral-800" />
              <div className="flex items-center gap-4 text-neutral-400">
                <a
                  href="https://discord.gg/rakshex"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  aria-label="Discord"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M13.542 0c.264 0 .497.102.684.286a11.64 11.64 0 0 1 1.708 2.046c.114.183.166.386.166.529 0 .428-.415 4.398-.765 8.21-.084.95-.53 1.706-1.084 2.595a16.5 16.5 0 0 1-5.064 2.595q-.613-.841-1.084-1.785c.67-.183 1.258-.466 1.71-.833a10.6 10.6 0 0 0-.418-.331 15.2 15.2 0 0 1-10.118 0q-.206.171-.418.331c.452.367 1.04.65 1.71.833a16.5 16.5 0 0 1-1.084 1.785A16.5 16.5 0 0 1 .085 15.11C-.27 11.319.41 7.47.825 3.52c.046-.143.1-.346.166-.529A11.64 11.64 0 0 1 2.7 1.3C3.991.69 5.377.25 6.825.0c.18.32.388.753.535 1.097a15.2 15.2 0 0 1 4.573 0c.143-.344.351-.777.53-1.097 1.452.25 2.834.693 4.129 1.3M5.678 10.735c-.988 0-1.798-.922-1.798-2.046 0-1.123.81-2.046 1.798-2.046.99 0 1.798.922 1.798 2.046s-.808 2.046-1.798 2.046m6.644 0c-.988 0-1.798-.922-1.798-2.046 0-1.123.81-2.046 1.798-2.046.99 0 1.798.922 1.798 2.046s-.808 2.046-1.798 2.046" />
                  </svg>
                </a>
                <a
                  href="https://github.com/rakshex"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  aria-label="GitHub"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
                    />
                  </svg>
                </a>
                <a
                  href="https://twitter.com/rakshexhq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  aria-label="Twitter"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-neutral-400">
              <Link href="/blog" className="hover:text-white transition-colors">
                Blog
              </Link>
              <Link href="/docs" className="hover:text-white transition-colors">
                Docs
              </Link>
              <Link href="/pricing" className="hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/trust" className="hover:text-white transition-colors">
                Trust Center
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-neutral-500">
            <p>© 2026 RakshEx by Rashi Technologies. Bengaluru, India.</p>
            <Link
              href="/status"
              className="flex items-center gap-2 hover:text-neutral-400 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse block" />
              <span>All systems operational</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
