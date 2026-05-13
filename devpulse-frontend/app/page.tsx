"use client";
import Link from "next/link";
import { useState } from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-500">DevPulse</div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-4">
          <Link href="/pricing" className="hover:text-blue-400 transition-colors">Pricing</Link>
          <Link href="/dashboard" className="hover:text-blue-400 transition-colors">Dashboard</Link>
          <Link
            href={`${APP_URL}/api/oauth/login`}
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMobileMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-6 pb-4 space-y-3 border-b border-gray-800">
          <Link href="/pricing" className="block text-gray-300 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
          <Link href="/dashboard" className="block text-gray-300 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
          <Link
            href={`${APP_URL}/api/oauth/login`}
            className="block bg-blue-600 px-4 py-2 rounded text-center hover:bg-blue-700 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Get Started
          </Link>
        </div>
      )}

      <div className="text-center py-24 px-4">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          Secure Your AI Agents
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          Real-time security scanning, cost anomaly detection, and PII redaction
          for production LLM applications.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 px-4">
          <Link
            href={`${APP_URL}/api/oauth/login`}
            className="bg-white text-gray-900 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            Start Free Trial
          </Link>
          <Link
            href="/dashboard"
            className="border border-gray-600 px-8 py-3 rounded-lg hover:border-white transition-colors"
          >
            View Demo
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8 px-4 pb-24">
        <FeatureCard title="AgentGuard" desc="Stops infinite loops and budget bleeds instantly with kill switch." />
        <FeatureCard title="Shadow API Detection" desc="Finds undocumented endpoints in your codebase automatically." />
        <FeatureCard title="Cost Forecasting" desc="Predict your AI spend before the invoice arrives." />
        <FeatureCard title="Real-time Monitoring" desc="Live dashboard with cost anomaly detection and alerts." />
        <FeatureCard title="Compliance Reports" desc="PCI DSS & OWASP compliance reporting with export." />
        <FeatureCard title="Enterprise Ready" desc="MySQL, Docker, Razorpay payments, and production-grade security." />
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24">
        <h2 className="text-3xl font-bold text-center mb-8">Simple, Transparent Pricing</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-xl font-bold mb-2">Free</h3>
            <p className="text-3xl font-bold mb-4">$0<span className="text-sm text-gray-400">/mo</span></p>
            <ul className="space-y-2 text-gray-400 text-sm mb-6">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 2 Collections</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 3 Scans/day</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> OWASP Top 10 audit (read-only)</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Community Support</li>
            </ul>
            <Link href="/register" className="block w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-center">
              Get Started
            </Link>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-blue-500 relative">
            <div className="text-blue-400 text-sm font-semibold mb-2">POPULAR</div>
            <h3 className="text-xl font-bold mb-2 text-blue-400">Pro</h3>
            <p className="text-3xl font-bold mb-1">$99<span className="text-sm text-gray-400">/mo</span></p>
            <p className="text-xs text-gray-500 mb-4">≈ ₹8,299/mo</p>
            <ul className="space-y-2 text-gray-400 text-sm mb-6">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Unlimited Collections</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Advanced Security Scanning</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Kill Switch & Budget Caps</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Team Collaboration (5 members)</li>
            </ul>
            <Link href="/billing" className="block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-center">
              Get Started
            </Link>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-purple-500">
            <h3 className="text-xl font-bold mb-2 text-purple-400">Enterprise</h3>
            <p className="text-3xl font-bold mb-1">$499<span className="text-sm text-gray-400">/mo</span></p>
            <p className="text-xs text-gray-500 mb-4">≈ ₹41,599/mo</p>
            <ul className="space-y-2 text-gray-400 text-sm mb-6">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Everything in Pro</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> SSO / SAML 2.0</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 25 Team Members + RBAC</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Priority Support, 4h SLA</li>
            </ul>
            <Link href="/billing" className="block w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-center">
              Contact Sales
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800 py-8 text-center text-gray-500">
        <div className="space-x-4 mb-4">
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} DevPulse Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors">
      <h3 className="text-xl font-bold mb-2 text-blue-400">{title}</h3>
      <p className="text-gray-400">{desc}</p>
    </div>
  );
}
