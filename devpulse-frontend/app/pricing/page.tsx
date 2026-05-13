"use client";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Pricing</h1>
            <p className="text-gray-400 mt-1">
              Choose the plan that fits your needs
            </p>
          </div>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-8 rounded-lg border border-gray-700">
            <h2 className="text-2xl font-bold mb-2">Free</h2>
            <div className="mb-6">
              <p className="text-4xl font-bold">
                $0<span className="text-lg text-gray-400">/month</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">₹0/month</p>
            </div>
            <ul className="space-y-3 mb-8 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Up to 5 API endpoints scanned
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> 100 LLM calls/day via gateway
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> OWASP Top 10 audit (read-only)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> 2 Collections
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> 3 Scans/day
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Community Support
              </li>
            </ul>
            <Link
              href="/register"
              className="block w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-center"
            >
              Get Started
            </Link>
          </div>

          <div className="bg-gray-800 p-8 rounded-lg border border-blue-500 relative">
            <div className="text-blue-400 text-sm font-semibold mb-2">
              POPULAR
            </div>
            <h2 className="text-2xl font-bold mb-2">Pro</h2>
            <div className="mb-6">
              <p className="text-4xl font-bold">
                $99<span className="text-lg text-gray-400">/month</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">≈ ₹8,299/month</p>
            </div>
            <ul className="space-y-3 mb-8 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Up to 10,000 LLM calls/day
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Unlimited Collections + Postman/OpenAPI scans
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Advanced Security Scanning
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Shadow API & Spec-Drift Detection
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Kill Switch & Budget Caps
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> PII Redaction at Gateway
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Token Analytics & Cost Forecasting
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Compliance Reports (OWASP Top 10)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Team Collaboration (5 members)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> 85+ Prompt Injection Payload Library
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Email Support, 1-Business-Day SLA
              </li>
            </ul>
            <Link
              href="/billing"
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-center"
            >
              Get Started
            </Link>
          </div>

          <div className="bg-gray-800 p-8 rounded-lg border border-purple-500 relative">
            <div className="text-purple-400 text-sm font-semibold mb-2">
              ENTERPRISE
            </div>
            <h2 className="text-2xl font-bold mb-2">Enterprise</h2>
            <div className="mb-6">
              <p className="text-4xl font-bold">
                $499<span className="text-lg text-gray-400">/month</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">≈ ₹41,599/month</p>
            </div>
            <ul className="space-y-3 mb-8 text-gray-300">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Everything in Pro
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Up to 250,000 LLM calls/day
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Up to 25 Team Members + RBAC Roles
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> MCP Governance: Tool-Call Audit + Permission Graph
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Scheduled AI Red-Team Runs
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> SSO / SAML 2.0 Integration
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> OWASP / PCI / GDPR / SOC2-Prep Evidence Export
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Slack + Webhook + PagerDuty Alerting
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Priority Support, 4-Hour SLA on P1
              </li>
            </ul>
            <Link
              href="/billing"
              className="block w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-center"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
