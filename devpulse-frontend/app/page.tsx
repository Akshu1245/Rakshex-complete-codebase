"use client";
import Link from "next/link";
import { useEffect } from "react";

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
          sameAs: [
            "https://twitter.com/rakshexhq",
            "https://github.com/Akshu1245/rakshex-complete-codebase",
          ],
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

const FEATURES = [
  {
    icon: "security",
    title: "Security Scanner",
    desc: "87-payload prompt injection library, BOLA/IDOR detection, insecure HTTP, missing auth, secret leaks. OWASP API Top 10 + PCI DSS mapped.",
  },
  {
    icon: "monetization_on",
    title: "Cost Monitor",
    desc: "Holt-Winters forecasting, anomaly detection, per-model cost breakdown. Track thinking tokens from o1/o3/Claude. Budget caps with kill switch.",
  },
  {
    icon: "visibility_off",
    title: "Shadow API Discovery",
    desc: "Static route extraction for Express, FastAPI, Flask, Django, Spring Boot, Laravel. No production infrastructure needed.",
  },
  {
    icon: "psychology",
    title: "Thinking Token Attribution",
    desc: "First-in-world isolation of reasoning tokens. Differential computation + timing signals. Full pricing tables for all providers.",
  },
  {
    icon: "vpn_key",
    title: "Credential Scanning",
    desc: "10-rule secret detection: AWS, GitHub, OpenAI, Anthropic, Stripe, Slack, JWT, private keys. Aadhaar & PAN detection for India compliance.",
  },
  {
    icon: "gavel",
    title: "Compliance Reports",
    desc: "SOC2 evidence builder, PCI DSS v4.0.1 mapping, OWASP compliance scores. Export as JSON, CSV, PDF. Ready for Vanta/Drata import.",
  },
  {
    icon: "power_settings_new",
    title: "Kill Switch",
    desc: "Autonomous circuit breaker. Trip on budget, anomaly, or red-team score. Sub-second response. Tested with 200→402 trip in CI.",
  },
  {
    icon: "smart_toy",
    title: "Security Copilot",
    desc: "Deterministic explainers for every finding. OWASP + PCI DSS citations. No hallucination risk. CWE-mapped remediation suggestions.",
  },
  {
    icon: "hub",
    title: "MCP Governance",
    desc: "MCP tool registry, risk scoring, approval workflows. Tool-call allowlists per agent. Prompt injection detection on tool inputs.",
  },
];

const PRICING = [
  {
    plan: "Free",
    price: "$0",
    inr: "₹0",
    features: ["2 Collections", "3 Scans/day", "OWASP Top 10 audit", "Community Support"],
    cta: "Get Started",
    href: "/register",
  },
  {
    plan: "Pro",
    price: "$99",
    inr: "≈ ₹8,299",
    popular: true,
    features: [
      "Unlimited Collections",
      "Advanced Security Scanning",
      "Kill Switch & Budget Caps",
      "Team (5 members)",
      "Slack & Discord Alerts",
      "API Access",
    ],
    cta: "Start Free Trial",
    href: "/billing",
  },
  {
    plan: "Enterprise",
    price: "$499",
    inr: "≈ ₹41,599",
    features: [
      "Everything in Pro",
      "SSO / SAML 2.0",
      "25 Team Members + RBAC",
      "Priority Support, 4h SLA",
      "SOC2 Evidence Builder",
      "Custom Data Retention",
    ],
    cta: "Contact Sales",
    href: "/billing",
  },
];

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-background text-on-background"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <JsonLdInjector />

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {/* Hero */}
      <section className="relative overflow-hidden py-28 px-8 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(207,188,255,0.12),transparent)] pointer-events-none"></div>
        <div className="relative max-w-5xl mx-auto">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 border border-primary/30 bg-primary/10 text-primary mb-8"
            style={{ fontSize: "11px", letterSpacing: "0.15em" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary status-pulse"></span>
            FIRST AI RUNTIME GOVERNANCE PLATFORM — BUILT IN INDIA
          </span>
          <h1
            className="text-on-surface mb-6"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(40px, 7vw, 80px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Secure Your AI Agents
            <br />
            <span style={{ color: "#cfbcff" }}>Before They Cost You</span>
          </h1>
          <p
            className="text-on-surface-variant max-w-2xl mx-auto mb-10"
            style={{ fontSize: "16px", lineHeight: 1.7 }}
          >
            Rakshex scans every API endpoint, tracks every LLM token, and blocks every prompt
            injection — all inside your VS Code. Built with 4 patents, 478+ tests, and
            enterprise-grade security.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link
              href="/demo"
              className="px-8 py-4 bg-primary text-on-primary font-bold hover:shadow-[0_0_20px_rgba(207,188,255,0.4)] transition-all"
              style={{ fontSize: "12px", letterSpacing: "0.1em" }}
            >
              TRY LIVE DEMO — NO SIGNUP
            </Link>
            <Link
              href={`${APP_URL}/api/oauth/login`}
              className="px-8 py-4 border border-outline-variant text-on-surface font-bold hover:bg-surface-variant transition-all"
              style={{ fontSize: "12px", letterSpacing: "0.1em" }}
            >
              START FREE TRIAL
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { v: "478+", l: "Server Tests" },
              { v: "4", l: "Patents Filed" },
              { v: "37", l: "API Routers" },
              { v: "18", l: "DB Migrations" },
            ].map((s) => (
              <div key={s.l} className="glass-card p-4 text-center">
                <div
                  className="text-primary"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "28px",
                    fontWeight: 700,
                  }}
                >
                  {s.v}
                </div>
                <div
                  className="text-on-surface-variant mt-1"
                  style={{ fontSize: "11px", letterSpacing: "0.1em" }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <div className="border-y border-outline-variant/20 bg-surface-container-lowest/40 py-6 px-8">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {[
            { icon: "lock", label: "AES-256-GCM Encryption" },
            { icon: "security", label: "OWASP API Top 10 Certified" },
            { icon: "verified_user", label: "PCI DSS v4.0.1 Ready" },
            { icon: "patent", label: "4 Patents Filed" },
            { icon: "workspace_premium", label: "SOC 2 Type II In Progress" },
            { icon: "flag", label: "Built in India 🇮🇳" },
          ].map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-2 text-on-surface-variant"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.05em",
              }}
            >
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
              >
                {b.icon}
              </span>
              {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-primary mb-2" style={{ fontSize: "11px", letterSpacing: "0.15em" }}>
            CAPABILITIES
          </p>
          <h2
            className="text-on-surface"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "36px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Everything You Need to Ship Secure AI
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card p-6 rounded-xl">
              <div className="w-10 h-10 bg-primary-container/20 border border-primary/20 flex items-center justify-center mb-4">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1", fontSize: "20px" }}
                >
                  {f.icon}
                </span>
              </div>
              <h3
                className="text-on-surface font-bold mb-2"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px" }}
              >
                {f.title}
              </h3>
              <p className="text-on-surface-variant" style={{ fontSize: "13px", lineHeight: 1.7 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="bg-surface-container/30 py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary mb-2" style={{ fontSize: "11px", letterSpacing: "0.15em" }}>
              COMPETITIVE EDGE
            </p>
            <h2
              className="text-on-surface"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "36px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              What Makes Rakshex Different
            </h2>
          </div>
          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr
                  className="border-b border-outline-variant/20 bg-surface-container-low/50"
                  style={{ fontSize: "10px", letterSpacing: "0.1em" }}
                >
                  <th className="px-6 py-4 text-on-surface-variant font-bold">CAPABILITY</th>
                  {["Postman", "Snyk", "Datadog", "Rakshex"].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-center font-bold ${h === "Rakshex" ? "text-primary" : "text-on-surface-variant"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5" style={{ fontSize: "13px" }}>
                {[
                  ["API Security Scanning", false, false, false, true],
                  ["LLM Cost Tracking", false, false, true, true],
                  ["Prompt Injection Blocking", false, false, false, true],
                  ["PII Redaction (real-time)", false, false, false, true],
                  ["Shadow API Detection", false, false, false, true],
                  ["Kill Switch", false, false, false, true],
                  ["PCI DSS Compliance", false, false, false, true],
                  ["VS Code Integration", false, false, false, true],
                  ["SSO + RBAC", true, true, true, true],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-surface-variant/10 transition-colors">
                    <td className="px-6 py-3 text-on-surface">{row[0] as string}</td>
                    {(row.slice(1) as boolean[]).map((cell, j) => (
                      <td key={j} className="px-6 py-3 text-center">
                        {cell ? (
                          <span
                            className="material-symbols-outlined text-primary"
                            style={{ fontVariationSettings: "'FILL' 1", fontSize: "18px" }}
                          >
                            check_circle
                          </span>
                        ) : (
                          <span
                            className="material-symbols-outlined text-on-surface-variant/30"
                            style={{ fontSize: "18px" }}
                          >
                            cancel
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-primary mb-2" style={{ fontSize: "11px", letterSpacing: "0.15em" }}>
            PRICING
          </p>
          <h2
            className="text-on-surface"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "36px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Simple, Transparent Pricing
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {PRICING.map((p) => (
            <div
              key={p.plan}
              className={`glass-card p-6 rounded-xl relative ${p.popular ? "border-primary/40" : ""}`}
            >
              {p.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 font-bold"
                  style={{ fontSize: "10px", letterSpacing: "0.1em" }}
                >
                  MOST POPULAR
                </div>
              )}
              <p
                className={`font-bold mb-2 ${p.popular ? "text-primary" : "text-on-surface"}`}
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px" }}
              >
                {p.plan}
              </p>
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className="text-on-surface"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "40px",
                    fontWeight: 700,
                  }}
                >
                  {p.price}
                </span>
                <span className="text-on-surface-variant" style={{ fontSize: "13px" }}>
                  /mo
                </span>
              </div>
              <p className="text-on-surface-variant mb-6" style={{ fontSize: "11px" }}>
                {p.inr}/mo
              </p>
              <ul className="space-y-2.5 mb-8">
                {p.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-on-surface-variant"
                    style={{ fontSize: "13px" }}
                  >
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontVariationSettings: "'FILL' 1", fontSize: "16px" }}
                    >
                      check_circle
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`block w-full py-3 font-bold text-center transition-all ${p.popular ? "bg-primary text-on-primary hover:shadow-[0_0_15px_rgba(207,188,255,0.4)]" : "bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-variant"}`}
                style={{ fontSize: "12px", letterSpacing: "0.08em" }}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 px-8 text-center border-t border-outline-variant/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(207,188,255,0.08),transparent)] pointer-events-none"></div>
        <div className="relative max-w-3xl mx-auto">
          <h2
            className="text-on-surface mb-4"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "40px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Ready to Ship Secure AI?
          </h2>
          <p className="text-on-surface-variant mb-8" style={{ fontSize: "15px" }}>
            478+ tests. 4 patents. 37 API routers. One platform. Deploy in 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/demo"
              className="px-8 py-4 bg-primary text-on-primary font-bold hover:shadow-[0_0_20px_rgba(207,188,255,0.4)] transition-all"
              style={{ fontSize: "12px", letterSpacing: "0.1em" }}
            >
              TRY LIVE DEMO →
            </Link>
            <Link
              href={`${APP_URL}/api/oauth/login`}
              className="px-8 py-4 border border-outline-variant text-on-surface font-bold hover:bg-surface-variant transition-all"
              style={{ fontSize: "12px", letterSpacing: "0.1em" }}
            >
              START FREE TRIAL
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant/20 py-12 px-8 bg-surface-container-lowest/50">
        <div
          className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8"
          style={{ fontSize: "13px" }}
        >
          {[
            {
              title: "Product",
              links: [
                ["Features", "/features"],
                ["Pricing", "/pricing"],
                ["Changelog", "/changelog"],
                ["Integrations", "/integrations"],
                ["Live Demo", "/demo"],
              ],
            },
            {
              title: "Solutions",
              links: [
                ["Fintech", "/solutions/fintech"],
                ["Healthcare", "/solutions/healthcare"],
                ["Enterprise", "/solutions/enterprise"],
                ["Comparisons", "/compare"],
                ["ROI Calculator", "/roi-calculator"],
              ],
            },
            {
              title: "Resources",
              links: [
                ["Blog", "/blog"],
                ["FAQ", "/faq"],
                ["Trust Center", "/trust"],
                ["Status", "/status"],
                ["Open Source", "/open-source"],
              ],
            },
            {
              title: "Company",
              links: [
                ["About", "/about"],
                ["Partners", "/partners"],
                ["Terms", "/terms"],
                ["Privacy", "/privacy"],
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4
                className="text-on-surface font-bold mb-3"
                style={{ fontSize: "11px", letterSpacing: "0.1em" }}
              >
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center pt-8 border-t border-outline-variant/20 text-on-surface-variant"
          style={{ fontSize: "12px" }}
        >
          <p>© {new Date().getFullYear()} Rakshex by Rashi Technologies. Bengaluru, India.</p>
          <div className="flex items-center gap-6 mt-4 md:mt-0">
            <a
              href="https://github.com/Akshu1245/rakshex-complete-codebase"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-on-surface transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com/rakshexhq"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-on-surface transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://linkedin.com/company/rakshex"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-on-surface transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
