"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useCountdown } from "@/lib/animations/countdown";
import { useMegaMenu } from "@/lib/animations/megamenu";
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
  Menu,
  X,
} from "lucide-react";

const HIDE_BANNER_PATHS = [
  "/login",
  "/register",
  "/reset-password",
  "/privacy",
  "/terms",
  "/cookies",
];

export function PublicHeader() {
  const pathname = usePathname();
  const timeLeft = useCountdown("2026-07-01T00:00:00Z");
  const { activeMenu, handleMouseEnter, handleMouseLeave, forceClose } = useMegaMenu();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isZero =
    timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  const showBanner = !HIDE_BANNER_PATHS.some((p) => pathname === p);

  return (
    <div className="fixed top-0 left-0 right-0 w-full z-50 flex flex-col">
      {/* SECTION 1 — sticky announcement bar */}
      {showBanner && (
        <div className="w-full bg-transparent border-b border-[#14B8A6]">
          <Link className="block" href="/changelog">
            <div className="mx-auto flex h-10 w-full max-w-[1280px] items-center justify-between px-6">
              <p className="min-w-0 truncate text-left text-xs font-medium text-white sm:text-sm">
                🔒 RakshEx Launch Week — India's First AI Runtime Governance Platform →
              </p>
              {mounted && !isZero && (
                <span
                  aria-label="Launch countdown"
                  className="flex shrink-0 flex-row items-center gap-1.5 text-xs text-[#9CA3AF]"
                >
                  <span className="hidden md:inline mr-1 text-[11px] uppercase tracking-wider text-[#9CA3AF]">
                    Launch in:
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="rounded bg-[#0F1419] border border-[#14B8A6] px-1.5 py-0.5 font-bold font-mono text-[#14B8A6]">
                      {timeLeft.days}d
                    </span>
                    <span>:</span>
                    <span className="rounded bg-[#0F1419] border border-[#14B8A6] px-1.5 py-0.5 font-bold font-mono text-[#14B8A6]">
                      {timeLeft.hours}h
                    </span>
                    <span>:</span>
                    <span className="rounded bg-[#0F1419] border border-[#14B8A6] px-1.5 py-0.5 font-bold font-mono text-[#14B8A6]">
                      {timeLeft.minutes}m
                    </span>
                    <span>:</span>
                    <span className="rounded bg-[#0F1419] border border-[#14B8A6] px-1.5 py-0.5 font-bold font-mono text-[#14B8A6]">
                      {timeLeft.seconds}s
                    </span>
                  </span>
                </span>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* SECTION 2 — Navbar Redesign (Mega Menu) */}
      <nav
        className="bg-[#0F1419]/90 backdrop-blur-md w-full border-b border-[#1A1F2E]"
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex justify-between items-center max-w-[1280px] mx-auto px-6 h-14">
          <div className="flex items-center gap-10">
            <Link className="flex items-center gap-2 no-underline shrink-0" href="/">
              <div className="flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-[#14B8A6] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span className="text-xl font-bold font-manrope tracking-tight text-white">
                  RakshEx
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex gap-8 items-center ml-10">
              {/* Products Mega Dropdown */}
              <div className="relative py-4" onMouseEnter={() => handleMouseEnter("products")}>
                <div className="flex items-center gap-1 text-white text-sm font-medium hover:text-[#14B8A6] cursor-pointer select-none transition-colors">
                  Products
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                </div>
                <div
                  className={`absolute top-full left-[-100px] pt-2 transition-all duration-200 ${activeMenu === "products" ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"}`}
                >
                  <div className="bg-transparent border border-[#14B8A6]/20 rounded-xl overflow-hidden shadow-2xl w-[640px] p-6 grid grid-cols-2 gap-6">
                    {/* Column 1 */}
                    <div className="space-y-4">
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#security-scanner"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            Security Scanner
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            87-payload injection library, OWASP Top 10
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#kill-switch"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <Power className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            AgentGuard Kill Switch
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            Autonomous circuit breaker, sub-second
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#shadow-api"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <Ghost className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            Shadow API Discovery
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            Find undocumented endpoints instantly
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#credentials"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <Key className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            Credential Scanner
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            AWS, GitHub, Aadhaar, PAN detection
                          </p>
                        </div>
                      </Link>
                    </div>
                    {/* Column 2 */}
                    <div className="space-y-4">
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#cost-monitor"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <BarChart className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            Cost Monitor
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            Holt-Winters forecasting, anomaly detection
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#thinking-tokens"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <Brain className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            Thinking Token Attribution
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            World-first reasoning token isolation
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#compliance"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            Compliance Reports
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            SOC2, PCI DSS, OWASP. One-click PDF
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#mcp"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-[#0F1419] border border-[#14B8A6]/10 group-hover:border-[#14B8A6]/30 rounded-lg flex items-center justify-center text-teal-accent transition-all shrink-0">
                          <Network className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-teal-accent transition-colors">
                            MCP Governance
                          </p>
                          <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                            Tool registry, risk scoring, allowlists
                          </p>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compare Dropdown */}
              <div className="relative py-4" onMouseEnter={() => handleMouseEnter("compare")}>
                <div className="flex items-center gap-1 text-white text-sm font-medium hover:text-[#14B8A6] cursor-pointer select-none transition-colors">
                  Compare
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                </div>
                <div
                  className={`absolute top-full left-0 pt-2 transition-all duration-200 ${activeMenu === "compare" ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"}`}
                >
                  <div className="bg-transparent border border-[#14B8A6]/20 rounded-xl overflow-hidden shadow-2xl w-56 p-4 flex flex-col gap-1.5 text-left">
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1.5 transition-colors border-b border-[#1A1F2E] pb-2"
                      href="/compare/rakshex-vs-snyk"
                      onClick={forceClose}
                    >
                      RakshEx vs Snyk →
                    </Link>
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1.5 transition-colors border-b border-[#1A1F2E] pb-2"
                      href="/compare/rakshex-vs-datadog"
                      onClick={forceClose}
                    >
                      RakshEx vs Datadog →
                    </Link>
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1.5 transition-colors border-b border-[#1A1F2E] pb-2"
                      href="/compare/rakshex-vs-traceable"
                      onClick={forceClose}
                    >
                      RakshEx vs Traceable AI →
                    </Link>
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1.5 transition-colors"
                      href="/compare/rakshex-vs-salt"
                      onClick={forceClose}
                    >
                      RakshEx vs Salt Security →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Resources Dropdown */}
              <div className="relative py-4" onMouseEnter={() => handleMouseEnter("resources")}>
                <div className="flex items-center gap-1 text-white text-sm font-medium hover:text-[#14B8A6] cursor-pointer select-none transition-colors">
                  Resources
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                </div>
                <div
                  className={`absolute top-full left-0 pt-2 transition-all duration-200 ${activeMenu === "resources" ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"}`}
                >
                  <div className="bg-transparent border border-[#14B8A6]/20 rounded-xl overflow-hidden shadow-2xl w-48 p-4 flex flex-col gap-1.5 text-left">
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1 transition-colors"
                      href="/blog"
                      onClick={forceClose}
                    >
                      Blog
                    </Link>
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1 transition-colors"
                      href="/docs"
                      onClick={forceClose}
                    >
                      Docs
                    </Link>
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1 transition-colors"
                      href="/changelog"
                      onClick={forceClose}
                    >
                      Changelog
                    </Link>
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1 transition-colors"
                      href="/roi-calculator"
                      onClick={forceClose}
                    >
                      ROI Calculator
                    </Link>
                    <Link
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1 transition-colors"
                      href="/faq"
                      onClick={forceClose}
                    >
                      FAQ
                    </Link>
                  </div>
                </div>
              </div>

              {/* Install Dropdown */}
              <div className="relative py-4" onMouseEnter={() => handleMouseEnter("install")}>
                <div className="flex items-center gap-1 text-white text-sm font-medium hover:text-[#14B8A6] cursor-pointer select-none transition-colors">
                  Install
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                </div>
                <div
                  className={`absolute top-full left-0 pt-2 transition-all duration-200 ${
                    activeMenu === "install"
                      ? "opacity-100 visible translate-y-0"
                      : "opacity-0 invisible -translate-y-2"
                  }`}
                >
                  <div className="bg-transparent border border-[#14B8A6]/20 rounded-xl overflow-hidden shadow-2xl w-48 p-4 flex flex-col gap-1.5 text-left">
                    <a
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1 transition-colors flex items-center justify-between"
                      href="https://npmjs.com/package/rakshex"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={forceClose}
                    >
                      <span>npm CLI</span>
                      <span className="text-[10px] text-[#14B8A6]">→</span>
                    </a>
                    <a
                      className="text-[#9CA3AF] hover:text-[#14B8A6] text-xs py-1 transition-colors flex items-center justify-between"
                      href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={forceClose}
                    >
                      <span>VS Code</span>
                      <span className="text-[10px] text-[#14B8A6]">→</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex gap-4 items-center">
            {/* Discord */}
            <a
              href="https://discord.gg/rakshex"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="text-[#9CA3AF] hover:text-[#14B8A6] transition-colors hidden md:inline-block"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
            </a>
            {/* GitHub */}
            <a
              href="https://github.com/rakshex-hq"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-[#9CA3AF] hover:text-[#14B8A6] transition-colors hidden md:inline-block"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
            <Link
              className="text-white hover:text-[#14B8A6] bg-transparent transition-colors text-sm font-medium hidden md:inline"
              href="/login"
            >
              Sign In
            </Link>
            <Link
              className="bg-[#14B8A6] hover:bg-[#0D9488] active:bg-[#0A7F6F] text-white font-semibold text-sm font-sans px-4 py-2 rounded-[6px] transition-all duration-200"
              href="/register"
            >
              Start Free
            </Link>
            <button
              className="lg:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Mobile Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0F1419] border-t border-[#1A1F2E] px-6 py-6 space-y-6 animate-fadeIn">
            <div className="space-y-3">
              <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                Products
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#security-scanner"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Security Scanner
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#kill-switch"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Kill Switch
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#shadow-api"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Shadow API
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#credentials"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Credential Scanner
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#cost-monitor"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Cost Monitor
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#thinking-tokens"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Thinking Tokens
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#compliance"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Compliance
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="/features#mcp"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  MCP Gov
                </Link>
              </div>
            </div>
            <div className="space-y-3 border-t border-[#1A1F2E] pt-4">
              <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                Compare
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  className="text-sm text-neutral-300"
                  href="/compare/rakshex-vs-snyk"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  RakshEx vs Snyk
                </Link>
                <Link
                  className="text-sm text-neutral-300"
                  href="/compare/rakshex-vs-datadog"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  RakshEx vs Datadog
                </Link>
                <Link
                  className="text-sm text-neutral-300"
                  href="/compare/rakshex-vs-traceable"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  RakshEx vs Traceable AI
                </Link>
              </div>
            </div>
            <div className="space-y-3 border-t border-[#1A1F2E] pt-4">
              <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                Resources
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  className="text-sm text-neutral-300"
                  href="/blog"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </Link>
                <Link
                  className="text-sm text-neutral-300"
                  href="/docs"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Docs
                </Link>
                <Link
                  className="text-sm text-neutral-300"
                  href="/changelog"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Changelog
                </Link>
                <Link
                  className="text-sm text-neutral-300"
                  href="/roi-calculator"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ROI Calc
                </Link>
              </div>
            </div>
            <div className="space-y-3 border-t border-[#1A1F2E] pt-4">
              <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                Install
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="https://npmjs.com/package/rakshex"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  npm
                </a>
                <a
                  className="text-sm text-neutral-300 hover:text-teal-accent"
                  href="https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  VS Code
                </a>
              </div>
            </div>
            <div className="border-t border-[#1A1F2E] pt-4 flex gap-4">
              <Link
                className="flex-1 text-center bg-transparent hover:text-[#14B8A6] text-white border border-[#1A1F2E] py-2.5 rounded font-medium text-sm transition-colors duration-200"
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                className="flex-1 text-center bg-[#14B8A6] text-white hover:bg-[#0D9488] active:bg-[#0A7F6F] py-2.5 rounded font-bold text-sm transition-all duration-200"
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
              >
                Start Free
              </Link>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
