"use client";

import Link from "next/link";
import { useState } from "react";
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

export function PublicHeader() {
  const timeLeft = useCountdown("2026-06-15T00:00:00Z");
  const { activeMenu, handleMouseEnter, handleMouseLeave, forceClose } = useMegaMenu();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 right-0 w-full z-50 flex flex-col">
      {/* SECTION 1 — sticky announcement bar */}
      <div className="w-full bg-[#0f172a] border-b border-neutral-800/80 backdrop-blur-md">
        <Link className="block" href="/changelog">
          <div className="mx-auto flex h-10 w-full max-w-[1280px] items-center justify-between px-6">
            <p className="min-w-0 truncate text-left text-xs font-medium text-neutral-200 sm:text-sm">
              🔒 RakshEx Launch Week — India's First AI Runtime Governance Platform →
            </p>
            <span
              aria-label="Launch countdown"
              className="flex shrink-0 flex-row items-center gap-1.5 text-xs text-neutral-400"
            >
              <span className="hidden md:inline mr-1 text-[11px] uppercase tracking-wider text-neutral-500">
                Launch in:
              </span>
              <span className="flex items-center gap-1">
                <span className="rounded bg-neutral-800/60 border border-neutral-700/50 px-1 py-0.5 font-bold font-mono text-cyan-400">
                  {timeLeft.days}d
                </span>
                <span>:</span>
                <span className="rounded bg-neutral-800/60 border border-neutral-700/50 px-1 py-0.5 font-bold font-mono text-cyan-400">
                  {timeLeft.hours}h
                </span>
                <span>:</span>
                <span className="rounded bg-neutral-800/60 border border-neutral-700/50 px-1 py-0.5 font-bold font-mono text-cyan-400">
                  {timeLeft.minutes}m
                </span>
                <span>:</span>
                <span className="rounded bg-neutral-800/60 border border-neutral-700/50 px-1 py-0.5 font-bold font-mono text-cyan-400">
                  {timeLeft.seconds}s
                </span>
              </span>
            </span>
          </div>
        </Link>
      </div>

      {/* SECTION 2 — Navbar Redesign (Mega Menu) */}
      <nav
        className="bg-[#0F0F0F]/95 backdrop-blur-md w-full border-b border-neutral-900"
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex justify-between items-center max-w-[1280px] mx-auto px-6 h-14">
          <div className="flex items-center gap-10">
            <Link className="flex items-center gap-2 no-underline shrink-0" href="/">
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-cyan-400" />
                <span className="text-xl font-bold font-manrope tracking-tight text-white">
                  RakshEx
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex gap-8 items-center ml-10">
              {/* Products Mega Dropdown */}
              <div className="relative py-4" onMouseEnter={() => handleMouseEnter("products")}>
                <div className="flex items-center gap-1 text-white text-sm font-medium opacity-90 hover:opacity-100 cursor-pointer select-none">
                  Products
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === "products" ? "rotate-180" : ""}`}
                  />
                </div>
                <div
                  className={`absolute top-full left-[-100px] pt-2 transition-all duration-200 ${activeMenu === "products" ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"}`}
                >
                  <div className="bg-neutral-900 border border-neutral-850 rounded-xl overflow-hidden shadow-2xl w-[640px] p-6 grid grid-cols-2 gap-6">
                    {/* Column 1 */}
                    <div className="space-y-4">
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#security-scanner"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            Security Scanner
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
                            87-payload injection library, OWASP Top 10
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#kill-switch"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <Power className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            AgentGuard Kill Switch
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
                            Autonomous circuit breaker, sub-second
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#shadow-api"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <Ghost className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            Shadow API Discovery
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
                            Find undocumented endpoints instantly
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#credentials"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <Key className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            Credential Scanner
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
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
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <BarChart className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            Cost Monitor
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
                            Holt-Winters forecasting, anomaly detection
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#thinking-tokens"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <Brain className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            Thinking Token Attribution
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
                            World-first reasoning token isolation
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#compliance"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            Compliance Reports
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
                            SOC2, PCI DSS, OWASP. One-click PDF
                          </p>
                        </div>
                      </Link>
                      <Link
                        className="flex items-start gap-3 group"
                        href="/features#mcp"
                        onClick={forceClose}
                      >
                        <div className="w-10 h-10 bg-neutral-800 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors shrink-0">
                          <Network className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold group-hover:text-cyan-400 transition-colors">
                            MCP Governance
                          </p>
                          <p className="text-neutral-500 text-[11px] leading-relaxed mt-0.5">
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
                <div className="flex items-center gap-1 text-white text-sm font-medium opacity-90 hover:opacity-100 cursor-pointer select-none">
                  Compare
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === "compare" ? "rotate-180" : ""}`}
                  />
                </div>
                <div
                  className={`absolute top-full left-0 pt-2 transition-all duration-200 ${activeMenu === "compare" ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"}`}
                >
                  <div className="bg-neutral-900 border border-neutral-850 rounded-xl overflow-hidden shadow-2xl w-56 p-4 flex flex-col gap-1.5 text-left">
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1.5 transition-colors border-b border-neutral-800 pb-2"
                      href="/compare/rakshex-vs-snyk"
                      onClick={forceClose}
                    >
                      RakshEx vs Snyk →
                    </Link>
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1.5 transition-colors border-b border-neutral-800 pb-2"
                      href="/compare/rakshex-vs-datadog"
                      onClick={forceClose}
                    >
                      RakshEx vs Datadog →
                    </Link>
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1.5 transition-colors border-b border-neutral-800 pb-2"
                      href="/compare/rakshex-vs-traceable"
                      onClick={forceClose}
                    >
                      RakshEx vs Traceable AI →
                    </Link>
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1.5 transition-colors"
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
                <div className="flex items-center gap-1 text-white text-sm font-medium opacity-90 hover:opacity-100 cursor-pointer select-none">
                  Resources
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMenu === "resources" ? "rotate-180" : ""}`}
                  />
                </div>
                <div
                  className={`absolute top-full left-0 pt-2 transition-all duration-200 ${activeMenu === "resources" ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2"}`}
                >
                  <div className="bg-neutral-900 border border-neutral-850 rounded-xl overflow-hidden shadow-2xl w-48 p-4 flex flex-col gap-1.5 text-left">
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1 transition-colors"
                      href="/blog"
                      onClick={forceClose}
                    >
                      Blog
                    </Link>
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1 transition-colors"
                      href="/docs"
                      onClick={forceClose}
                    >
                      Docs
                    </Link>
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1 transition-colors"
                      href="/changelog"
                      onClick={forceClose}
                    >
                      Changelog
                    </Link>
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1 transition-colors"
                      href="/roi-calculator"
                      onClick={forceClose}
                    >
                      ROI Calculator
                    </Link>
                    <Link
                      className="text-neutral-400 hover:text-cyan-400 text-xs py-1 transition-colors"
                      href="/faq"
                      onClick={forceClose}
                    >
                      FAQ
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex gap-4 items-center">
            <Link
              className="text-neutral-400 hover:text-white transition-colors text-sm font-medium hidden md:inline"
              href="/login"
            >
              Sign In
            </Link>
            <Link
              className="bg-[#06b6d4] hover:bg-[#0891b2] text-black font-semibold text-xs font-mono uppercase tracking-wider px-4 py-2 rounded shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all"
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
          <div className="lg:hidden bg-neutral-950 border-t border-neutral-900 px-6 py-6 space-y-6 animate-fadeIn">
            <div className="space-y-3">
              <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                Products
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#security-scanner"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Security Scanner
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#kill-switch"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Kill Switch
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#shadow-api"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Shadow API
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#credentials"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Credential Scanner
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#cost-monitor"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Cost Monitor
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#thinking-tokens"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Thinking Tokens
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#compliance"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Compliance
                </Link>
                <Link
                  className="text-sm text-neutral-300 hover:text-cyan-400"
                  href="/features#mcp"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  MCP Gov
                </Link>
              </div>
            </div>
            <div className="space-y-3 border-t border-neutral-900 pt-4">
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
            <div className="space-y-3 border-t border-neutral-900 pt-4">
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
            <div className="border-t border-neutral-900 pt-4 flex gap-4">
              <Link
                className="flex-1 text-center bg-neutral-900 text-white border border-neutral-800 py-2.5 rounded font-medium text-sm"
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                className="flex-1 text-center bg-cyan-500 text-black py-2.5 rounded font-bold text-sm"
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
