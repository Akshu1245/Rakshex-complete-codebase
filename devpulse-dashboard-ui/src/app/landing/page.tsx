import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DevPulse – AI API Security & Cost Intelligence Platform',
  description:
    'Stop API breaches. Cut AI costs by 40%. The API Security & Cost Intelligence Platform built for the AI Agent Era.',
  keywords: ['AI API security', 'API cost intelligence', 'AI agent security', 'prompt injection', 'token leak detection', 'developer tools'],
  openGraph: {
    title: 'DevPulse – AI API Security & Cost Intelligence Platform',
    description: 'Stop API breaches. Cut AI costs by 40%. Built for the AI Agent Era.',
    type: 'website',
    url: 'https://devpulse.dev',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevPulse – AI API Security & Cost Intelligence Platform',
    description: 'Stop API breaches. Cut AI costs by 40%. Built for the AI Agent Era.',
  },
};

const PILLARS = [
  {
    icon: '🛡️',
    title: 'AI API Security Scanner',
    subtitle: 'Find what attackers find — before they do',
    features: [
      '14 token/secret patterns (OpenAI, Anthropic, AWS, Stripe…)',
      '7 AI agent attack detectors (prompt injection, SSRF, tool abuse)',
      'OWASP API Security Top 10 (2023) coverage',
      'AI-powered fix suggestions via Groq LLM',
    ],
    color: 'from-red-500 to-orange-500',
    borderColor: 'border-red-500/30',
    hoverBorder: 'hover:border-red-500/50',
  },
  {
    icon: '💸',
    title: 'API Cost Intelligence',
    subtitle: 'Know exactly where every dollar goes',
    features: [
      'Real-time cost tracking across 20+ AI models',
      '30-day spend forecasting (weighted moving average)',
      'Anomaly detection with automatic alerts',
      'Optimization tips: model switching, caching, batching',
    ],
    color: 'from-emerald-500 to-cyan-500',
    borderColor: 'border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-500/50',
  },
  {
    icon: '⚡',
    title: 'VS Code Extension',
    subtitle: 'Security & costs inside your editor',
    features: [
      'Inline token leak warnings as you type',
      'Cost estimation per API call in hover tooltips',
      'One-click scan from command palette',
      'Real-time threat feed in sidebar',
    ],
    color: 'from-violet-500 to-blue-500',
    borderColor: 'border-violet-500/30',
    hoverBorder: 'hover:border-violet-500/50',
  },
];

const STATS = [
  { value: '14', label: 'Token Patterns' },
  { value: '7', label: 'Agent Attack Detectors' },
  { value: '20+', label: 'AI Models Priced' },
  { value: '< 2s', label: 'Scan Time' },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '3 scans / day',
      '5 API cost logs',
      '7-day history',
      'Basic security score',
      'VS Code extension',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    features: [
      'Unlimited scans',
      'Unlimited cost tracking',
      '90-day history',
      'AI fix suggestions (Groq LLM)',
      'Anomaly detection',
      'Spend forecasting',
      'Priority support',
    ],
    cta: 'Start 14-Day Free Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/month',
    features: [
      'Everything in Pro',
      'Team workspaces',
      'CI/CD security gates',
      'Custom threat rules',
      'SSO / SAML',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Paste or Connect', desc: 'Drop your code, OpenAPI spec, or connect your repo.' },
  { step: '2', title: 'Instant Scan', desc: 'AI scans for token leaks, agent attacks, and OWASP violations in < 2 seconds.' },
  { step: '3', title: 'Fix & Optimize', desc: 'Get AI-powered fix suggestions and cost optimization recommendations.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-violet-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="font-bold text-lg">DevPulse</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded-full border border-red-500/20 font-medium hidden sm:inline">v4.0</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#pillars" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">Features</a>
            <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">Pricing</a>
            <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <a
              href="#pricing"
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Scan Free
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-violet-500/3 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-400 mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Built for the AI Agent Era
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold mb-6 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent leading-tight">
            Stop API Breaches.<br />Cut AI Costs by 40%.
          </h1>
          <p className="text-lg sm:text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            The API Security &amp; Cost Intelligence Platform that finds token leaks,
            detects AI agent attacks, and optimizes your spend across 20+ AI models — in under 2 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#pricing"
              className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors text-lg shadow-lg shadow-red-500/20"
            >
              Scan Your Code Free
            </a>
            <a
              href="https://github.com/ganesh2317/DevPulse"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-colors text-lg border border-zinc-700"
            >
              View on GitHub
            </a>
          </div>
          <p className="text-xs text-zinc-600 mt-4">Free plan &bull; No credit card &bull; Results in seconds</p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-zinc-800/40 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800/40">
          {STATS.map((s) => (
            <div key={s.label} className="py-8 text-center">
              <p className="text-3xl font-extrabold bg-gradient-to-r from-red-400 to-violet-400 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Three Pillars */}
      <section id="pillars" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Three Pillars. One Platform.</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Security scanning, cost intelligence, and editor integration — purpose-built for teams shipping AI-powered products.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <div key={p.title} className={`bg-zinc-900/50 border ${p.borderColor} rounded-xl p-6 ${p.hoverBorder} transition-colors`}>
                <span className="text-3xl mb-3 block">{p.icon}</span>
                <h3 className="font-bold text-white text-lg mb-1">{p.title}</h3>
                <p className="text-sm text-zinc-500 mb-4">{p.subtitle}</p>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-zinc-900/30 border-t border-zinc-800/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((h) => (
              <div key={h.step} className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
                  {h.step}
                </div>
                <h3 className="font-semibold text-white mb-2">{h.title}</h3>
                <p className="text-sm text-zinc-400">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 border-t border-zinc-800/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-zinc-400">Start free. Upgrade when you need unlimited scans &amp; AI fix suggestions.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 border ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-red-500/10 to-zinc-900 border-red-500/40 ring-1 ring-red-500/20 scale-105'
                    : 'bg-zinc-900/50 border-zinc-800/60'
                }`}
              >
                {plan.highlighted && (
                  <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-white mt-2">{plan.name}</h3>
                <div className="mt-3 mb-4">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-zinc-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    plan.highlighted
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-zinc-800/40 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Your AI APIs Deserve Better Security</h2>
          <p className="text-zinc-400 mb-8">
            Join teams using DevPulse to scan for token leaks, detect agent attacks,
            and cut AI costs — all before shipping to production.
          </p>
          <a
            href="#pricing"
            className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors text-lg shadow-lg shadow-red-500/20"
          >
            Scan Your Code Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/40 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <p>DevPulse &copy; {new Date().getFullYear()} &middot; API Security &amp; Cost Intelligence Platform</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/ganesh2317/DevPulse" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">GitHub</a>
            <span>FastAPI + Next.js + PostgreSQL + Redis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
