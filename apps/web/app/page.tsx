"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { HeroSection } from "@/components/home/HeroSection";
import { AntiGravity } from "@/components/home/AntiGravity";
import { FeatureCards } from "@/components/home/FeatureCards";
import { BenchmarkSection } from "@/components/home/BenchmarkSection";
import { ChangelogSection } from "@/components/home/ChangelogSection";
import { AskAISection } from "@/components/home/AskAISection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { ComparisonSubNav } from "@/components/home/ComparisonSubNav";
import { ArchitectureCompareSlider } from "@/components/home/ArchitectureCompareSlider";
import { OneOnOneMatrix } from "@/components/home/OneOnOneMatrix";
import { PerformanceCostMatrix } from "@/components/home/PerformanceCostMatrix";
import { EcosystemIntegrations } from "@/components/home/EcosystemIntegrations";
import { WhyMoveToRaksHex } from "@/components/home/WhyMoveToRaksHex";
import { BuiltInCapabilities } from "@/components/home/BuiltInCapabilities";
import { OverviewSplash } from "@/components/home/OverviewSplash";
import { Footer } from "@/components/layout/Footer";
import { ChevronRight, ArrowRight } from "lucide-react";

// Rolling digit counter component
interface RollingDigitProps {
  char: string;
  trigger: boolean;
  antiGravity: boolean;
}

function RollingDigit({ char, trigger, antiGravity }: RollingDigitProps) {
  const isDigit = /\d/.test(char);
  const targetDigit = isDigit ? parseInt(char, 10) : 0;
  const [digit, setDigit] = useState(0);

  useEffect(() => {
    if (antiGravity && isDigit) {
      const interval = setInterval(
        () => {
          setDigit(Math.floor(Math.random() * 10));
        },
        70 + Math.random() * 50,
      );
      return () => clearInterval(interval);
    } else if (trigger && isDigit) {
      const t = setTimeout(() => {
        setDigit(targetDigit);
      }, 200);
      return () => clearTimeout(t);
    } else {
      setDigit(0);
    }
  }, [trigger, targetDigit, isDigit, antiGravity]);

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

function StatsCard({
  label,
  targetValue,
  antiGravity,
}: {
  label: string;
  targetValue: string;
  antiGravity: boolean;
}) {
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
    <article ref={containerRef} className="PlatformStatsShowcase_card__DyDV_ anti-gravity-float">
      <p className="PlatformStatsShowcase_label__dAs7X font-semibold text-xs tracking-wider uppercase">
        {label}
      </p>
      <div
        aria-label={targetValue}
        className="PlatformStatsShowcase_value__ypr4_ text-[#06b6d4] font-mono font-bold text-2xl md:text-3xl"
      >
        {targetValue.split("").map((char, idx) => (
          <RollingDigit key={idx} char={char} trigger={inView} antiGravity={antiGravity} />
        ))}
      </div>
    </article>
  );
}

function PlatformStats({ antiGravity }: { antiGravity: boolean }) {
  const statsQuery = trpc.system.stats.useQuery();
  const stats = statsQuery.data;

  const formatNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString());

  if (!stats) {
    return (
      <section className="py-20 bg-transparent">
        <div className="max-w-[1280px] mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Platform Statistics</h2>
          <p className="text-neutral-400 text-sm">
            Metrics will appear here once the platform has usage data.
          </p>
        </div>
      </section>
    );
  }

  const items = [
    { label: "Collections Scanned", value: formatNum(stats.collections) },
    { label: "Vulnerabilities Found", value: formatNum(stats.findings) },
    { label: "API Endpoints Protected", value: formatNum(stats.endpoints) },
    { label: "Active Users", value: formatNum(stats.users) },
  ];

  return (
    <section className="py-20 bg-transparent">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="flex flex-col items-center gap-3 text-center mb-10">
          <h2 className="text-3xl font-bold text-white">Platform Statistics</h2>
          <p className="text-neutral-400 text-sm">
            Real-time metrics from the RaksHex security engine
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((item) => (
            <StatsCard
              key={item.label}
              label={item.label}
              targetValue={item.value}
              antiGravity={antiGravity}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function RootHomePage() {
  const [antiGravity, setAntiGravity] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "What is RaksHex?",
      answer:
        "RaksHex is an Agent Firewall: runtime authorization for autonomous AI actions. It evaluates semantic actions against delegated authority, mediates the credentials those actions need, and writes every decision to a hash-chained Action Ledger — so a DENY is enforced, not just logged.",
    },
    {
      question: "What AI providers does RaksHex support?",
      answer:
        "OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Google Vertex/Gemini, GitHub Copilot, Claude Teams, Cursor, self-hosted models, and OpenAI-compatible endpoints.",
    },
    {
      question: "How is this different from a policy engine that just logs decisions?",
      answer:
        "Enforcement happens at the credential broker. A DENY blocks the secret itself, so a denied action can't fall back to a raw API key that still works elsewhere.",
    },
    {
      question: "Who should use RaksHex?",
      answer:
        "Any team building with AI agents, LLMs, or AI-powered APIs who needs security visibility, cost control, and compliance evidence.",
    },
  ];

  const [overviewOpen, setOverviewOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden font-sans selection:bg-[#14B8A6] selection:text-black pt-32 pb-24">
      {/* Signature Dotted Grid Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(20,184,166,0.15)_1px,transparent_0)] [background-size:24px_24px] pointer-events-none -z-10" />

      {/* Overview Splash Banner */}
      <OverviewSplash isOpen={overviewOpen} onClose={() => setOverviewOpen(false)} />

      {/* Anti-Gravity Physics Canvas and HUD Console */}
      <AntiGravity active={antiGravity} setActive={setAntiGravity} />

      {/* SECTION 3 & 4 — HERO SECTION & LOGOMARQUEE */}
      <HeroSection antiGravity={antiGravity} setAntiGravity={setAntiGravity} />

      {/* CLICKHOUSE CLOUD STYLE INTERACTIVE COMPARISON & VALUE SUITE */}
      <ComparisonSubNav onOverviewClick={() => setOverviewOpen(true)} />
      <PerformanceCostMatrix />
      <ArchitectureCompareSlider />
      <WhyMoveToRaksHex />
      <BuiltInCapabilities />
      <EcosystemIntegrations />
      <OneOnOneMatrix />

      {/* SECTION 5 — PRODUCT FEATURE CARDS */}
      <section
        className="relative w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 scroll-mt-24"
        id="features"
      >
        <FeatureCards />
      </section>

      {/* SECTION 6 — COMPARISON TABLE */}
      <BenchmarkSection />

      {/* SECTION 8 — TIMELINE/CHANGELOG */}
      <ChangelogSection />

      {/* SECTION 10 — TESTIMONIALS */}
      <TestimonialsSection />

      {/* SECTION 11 — FAQ SECTION */}
      <section
        className="w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 bg-transparent scroll-mt-24"
        id="faq"
      >
        <div className="flex flex-col lg:flex-row gap-12 max-w-5xl mx-auto items-start">
          <div className="lg:w-1/3 flex flex-col gap-4 text-left">
            <h2 className="text-3xl sm:text-[36px] font-bold text-white font-sans leading-tight tracking-[-0.02em]">
              Frequently Asked Questions
            </h2>
            <p className="text-[#9CA3AF] text-sm sm:text-base leading-relaxed">
              Questions? We&apos;ve got answers. If you don&apos;t find what you need, feel free to
              read our docs.
            </p>
            <Link
              className="inline-flex items-center gap-1.5 text-[#14B8A6] hover:text-[#0D9488] text-sm font-semibold transition-all mt-2"
              href="/docs"
            >
              or check out our Documentation
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="w-full lg:w-2/3 rounded-lg bg-transparent border border-[#14B8A6]/20 divide-y divide-white/5 shadow-md">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border-b border-white/5 last:border-b-0">
                <h3 className="flex">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className={`flex flex-1 items-center justify-between p-6 text-sm sm:text-base font-semibold font-sans text-white transition-all hover:text-[#14B8A6] cursor-pointer text-left gap-4 rounded ${openFaq === idx ? "text-[#14B8A6]" : ""}`}
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

      {/* SECTION 11B — PLATFORM STATISTICS */}
      <PlatformStats antiGravity={antiGravity} />

      {/* SECTION 13 — FOOTER */}
      <Footer />
    </div>
  );
}
