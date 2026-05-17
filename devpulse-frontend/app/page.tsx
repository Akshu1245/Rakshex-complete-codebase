"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function JsonLdInjector() {
  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://devpulse.in/#organization",
          name: "DevPulse",
          url: "https://devpulse.in",
          logo: "https://devpulse.in/logo.png",
          description:
            "AI Runtime Governance Platform — security scanning, cost monitoring, and compliance for production AI agents.",
          sameAs: [
            "https://twitter.com/devpulsehq",
            "https://github.com/Akshu1245/devpulse-complete-codebase",
          ],
        },
        {
          "@type": "WebSite",
          "@id": "https://devpulse.in/#website",
          url: "https://devpulse.in",
          name: "DevPulse",
          publisher: { "@id": "https://devpulse.in/#organization" },
        },
        {
          "@type": "SoftwareApplication",
          "@id": "https://devpulse.in/#product",
          name: "DevPulse",
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

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <JsonLdInjector />
      {/* Nav */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-500">DevPulse</div>
        <div className="hidden md:flex items-center space-x-6">
          <Link
            href="/demo"
            className="text-green-400 font-semibold hover:text-green-300 transition-colors"
          >
            Live Demo
          </Link>
          <Link href="/pricing" className="hover:text-blue-400 transition-colors">
            Pricing
          </Link>
          <Link href="/dashboard" className="hover:text-blue-400 transition-colors">
            Dashboard
          </Link>
          <Link
            href={`${APP_URL}/api/oauth/login`}
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </nav>
      {mobileMenuOpen && (
        <div className="md:hidden px-6 pb-4 space-y-3 border-b border-gray-800">
          <Link
            href="/demo"
            className="block text-green-400 font-semibold"
            onClick={() => setMobileMenuOpen(false)}
          >
            Live Demo
          </Link>
          <Link
            href="/pricing"
            className="block text-gray-300 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/dashboard"
            className="block text-gray-300 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href={`${APP_URL}/api/oauth/login`}
            className="block bg-blue-600 px-4 py-2 rounded text-center"
            onClick={() => setMobileMenuOpen(false)}
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Hero */}
      <div className="text-center py-24 px-4">
        <div className="inline-block bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-blue-600/30">
          🚀 First AI Runtime Governance Platform Built in India
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
          Secure Your AI Agents
          <br />
          Before They Cost You
        </h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
          DevPulse scans every API endpoint, tracks every LLM token, and blocks every prompt
          injection — all inside your VS Code. Built with 4 patents, 478+ tests, and
          enterprise-grade security.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 px-4 mb-12">
          <Link
            href="/demo"
            className="bg-green-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-green-700 transition-colors text-lg"
          >
            Try Live Demo — No Signup
          </Link>
          <Link
            href={`${APP_URL}/api/oauth/login`}
            className="bg-white text-gray-900 px-8 py-4 rounded-lg font-bold hover:bg-gray-100 transition-colors text-lg"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-center">
          <StatCard value="478+" label="Server Tests" />
          <StatCard value="4" label="Patents Filed" />
          <StatCard value="37" label="API Routers" />
          <StatCard value="18" label="DB Migrations" />
        </div>
      </div>

      {/* How it Works */}
      <div className="max-w-7xl mx-auto px-4 pb-24">
        <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          Three steps from zero to protected. No configuration required.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Drop a Collection",
              desc: "Import your Postman, OpenAPI, or Bruno collection. DevPulse auto-detects every endpoint, scans for secrets, and finds vulnerabilities in 3 seconds.",
              icon: "📂",
            },
            {
              step: "2",
              title: "See Instant Findings",
              desc: "Get security scores, credential leaks, OWASP compliance mapping, and PCI DSS audit reports. All with one click. No manual configuration.",
              icon: "🔍",
            },
            {
              step: "3",
              title: "Deploy Protection",
              desc: "Install our VS Code extension or GitHub Action. Every PR gets scanned. Every LLM call gets monitored. Your entire team stays protected.",
              icon: "🛡",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center"
            >
              <div className="text-4xl mb-4">{s.icon}</div>
              <div className="text-blue-500 text-sm font-bold mb-2">STEP {s.step}</div>
              <h3 className="text-xl font-bold mb-3">{s.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Differentiation */}
      <div className="bg-gray-800/50 py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">What Makes DevPulse Different</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            We combined API security + LLM cost governance into one platform. Nobody else does this.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-3 pr-4 text-gray-400 font-medium">Capability</th>
                  <th className="py-3 px-4 text-center">Postman</th>
                  <th className="py-3 px-4 text-center">Snyk</th>
                  <th className="py-3 px-4 text-center">Datadog</th>
                  <th className="py-3 px-4 text-center text-blue-400">DevPulse</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["API Security Scanning", "❌", "❌", "❌", "✅"],
                  ["LLM Cost Tracking", "❌", "❌", "✅", "✅"],
                  ["Prompt Injection Blocking", "❌", "❌", "❌", "✅"],
                  ["PII Redaction (real-time)", "❌", "❌", "❌", "✅"],
                  ["Shadow API Detection", "❌", "❌", "❌", "✅"],
                  ["Kill Switch", "❌", "❌", "❌", "✅"],
                  ["PCI DSS Compliance", "❌", "❌", "❌", "✅"],
                  ["VS Code Integration", "❌", "❌", "❌", "✅"],
                  ["MCP Tool Governance", "❌", "❌", "❌", "✅"],
                  ["SSO + RBAC", "✅", "✅", "✅", "✅"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-700/50">
                    <td className="py-3 pr-4">{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td
                        key={j}
                        className={`py-3 px-4 text-center ${j === 3 ? "text-blue-400 font-semibold" : ""}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto py-24 px-4">
        <h2 className="text-3xl font-bold text-center mb-4">
          Everything You Need to Ship Secure AI
        </h2>
        <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
          One platform. Every surface covered. No stitching tools together.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🔒"
            title="Security Scanner"
            desc="87-payload prompt injection library, BOLA/IDOR detection, insecure HTTP, missing auth, secret leaks. OWASP API Top 10 + PCI DSS mapped."
          />
          <FeatureCard
            icon="💰"
            title="Cost Monitor"
            desc="Holt-Winters forecasting, anomaly detection, per-model cost breakdown. Track thinking tokens from o1/o3/Claude. Budget caps with kill switch."
          />
          <FeatureCard
            icon="👻"
            title="Shadow API Discovery"
            desc="Static route extraction for Express, FastAPI, Flask, Django, Spring Boot, Laravel. No production infrastructure needed."
          />
          <FeatureCard
            icon="🧠"
            title="Thinking Token Attribution"
            desc="First-in-world isolation of reasoning tokens. Differential computation + timing signals. Full pricing tables for all providers. Patent NHCE/DEV/2026/002."
          />
          <FeatureCard
            icon="🔑"
            title="Credential Scanning"
            desc="10-rule secret detection: AWS, GitHub, OpenAI, Anthropic, Stripe, Slack, JWT, private keys. Aadhaar & PAN detection for India compliance."
          />
          <FeatureCard
            icon="📋"
            title="Compliance Reports"
            desc="SOC2 evidence builder, PCI DSS v4.0.1 mapping, OWASP compliance scores. Export as JSON, CSV, PDF. Ready for Vanta/Drata import."
          />
          <FeatureCard
            icon="⚡"
            title="Kill Switch"
            desc="Autonomous circuit breaker. Trip on budget, anomaly, or red-team score. Sub-second response. Tested with 200→402 trip in CI."
          />
          <FeatureCard
            icon="🤖"
            title="Security Copilot"
            desc="Deterministic explainers for every finding. OWASP + PCI DSS citations. No hallucination risk. CWE-mapped remediation suggestions."
          />
          <FeatureCard
            icon="🔌"
            title="GitHub Action"
            desc="PR comments with severity badges. Exact endpoint names, one-line fixes, cost impact in USD + INR. CI/CD integration in every repo."
          />
          <FeatureCard
            icon="🏢"
            title="Enterprise SSO"
            desc="SAML 2.0 + OIDC with JIT provisioning. 4-role RBAC. Workspace isolation. Okta, Google Workspace, Microsoft Entra support."
          />
          <FeatureCard
            icon="📊"
            title="Red Team Scheduler"
            desc="Automated adversarial testing. 87-payload library, cron scheduling, security scoring, run history. Continuous posture assessment."
          />
          <FeatureCard
            icon="🌐"
            title="MCP Governance"
            desc="MCP tool registry, risk scoring, approval workflows. Tool-call allowlists per agent. Prompt injection detection on tool inputs."
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="max-w-4xl mx-auto px-4 pb-24">
        <h2 className="text-3xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
        <p className="text-gray-400 text-center mb-12">
          Start free. Scale when you're ready. All prices in USD with INR equivalent.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <PricingCard
            plan="Free"
            price="$0"
            inr="₹0"
            features={["2 Collections", "3 Scans/day", "OWASP Top 10 audit", "Community Support"]}
            cta="Get Started"
            href="/register"
          />
          <PricingCard
            plan="Pro"
            price="$99"
            inr="≈ ₹8,299"
            popular
            features={[
              "Unlimited Collections",
              "Advanced Security Scanning",
              "Kill Switch & Budget Caps",
              "Team (5 members)",
              "Slack & Discord Alerts",
              "API Access",
            ]}
            cta="Start Free Trial"
            href="/billing"
          />
          <PricingCard
            plan="Enterprise"
            price="$499"
            inr="≈ ₹41,599"
            features={[
              "Everything in Pro",
              "SSO / SAML 2.0",
              "25 Team Members + RBAC",
              "Priority Support, 4h SLA",
              "SOC2 Evidence Builder",
              "Custom Data Retention",
            ]}
            cta="Contact Sales"
            href="/billing"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-20 px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Ship Secure AI?</h2>
        <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
          478+ tests. 4 patents. 37 API routers. One platform. Deploy in 5 minutes.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/demo"
            className="bg-white text-blue-700 px-8 py-4 rounded-lg font-bold hover:bg-gray-100 transition-colors text-lg"
          >
            Try Live Demo →
          </Link>
          <Link
            href={`${APP_URL}/api/oauth/login`}
            className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold hover:bg-white/10 transition-colors text-lg"
          >
            Start Free Trial
          </Link>
        </div>
      </div>

      {/* Trust */}
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <p className="text-gray-500 text-sm mb-6">TRUSTED BY ENGINEERS WORLDWIDE</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-gray-400 text-sm">
          <TrustBadge title="4 Patents" desc="NHCE/DEV/2026/001–004" />
          <TrustBadge title="478+ Tests" desc="Server-side test suite" />
          <TrustBadge title="18 Migrations" desc="Drizzle ORM + MySQL" />
          <TrustBadge title="India Built" desc="Bengaluru, Karnataka" />
        </div>
      </div>

      <footer className="border-t border-gray-800 py-12 text-center text-gray-500">
        <div className="space-x-6 mb-6">
          <Link href="/demo" className="hover:text-white transition-colors">
            Live Demo
          </Link>
          <Link href="/pricing" className="hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <a
            href="https://github.com/Akshu1245/devpulse-complete-codebase"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
        <p>
          &copy; {new Date().getFullYear()} DevPulse by Rashi Technologies. Bengaluru, India. All
          rights reserved.
        </p>
      </footer>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="text-2xl font-bold text-blue-400">{value}</div>
      <div className="text-gray-400 text-xs mt-1">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold mb-2 text-blue-400">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function PricingCard({
  plan,
  price,
  inr,
  popular,
  features,
  cta,
  href,
}: {
  plan: string;
  price: string;
  inr: string;
  popular?: boolean;
  features: string[];
  cta: string;
  href: string;
}) {
  return (
    <div
      className={`bg-gray-800 p-6 rounded-xl border ${popular ? "border-blue-500 relative" : "border-gray-700"}`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
          POPULAR
        </div>
      )}
      <h3 className={`text-xl font-bold mb-2 ${popular ? "text-blue-400" : ""}`}>{plan}</h3>
      <p className="text-3xl font-bold mb-1">
        {price}
        <span className="text-sm text-gray-400">/mo</span>
      </p>
      <p className="text-xs text-gray-500 mb-4">{inr}/mo</p>
      <ul className="space-y-2 text-gray-400 text-sm mb-6">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-green-400">✓</span> {f}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`block w-full py-3 rounded-lg font-medium transition-colors text-center ${popular ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-700 hover:bg-gray-600"}`}
      >
        {cta}
      </Link>
    </div>
  );
}

function TrustBadge({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
      <div className="font-semibold text-gray-300">{title}</div>
      <div className="text-gray-500 text-xs mt-1">{desc}</div>
    </div>
  );
}
