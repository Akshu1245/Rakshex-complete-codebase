import Link from "next/link";

export const metadata = {
  title: "FAQ — DevPulse AI Governance Platform",
  description:
    "Frequently asked questions about DevPulse pricing, security, compliance, setup, and enterprise features.",
  alternates: { canonical: "/faq" },
};

const FAQS = [
  {
    q: "What is DevPulse?",
    a: "DevPulse is an AI Runtime Governance platform that combines security scanning, cost monitoring, and compliance automation into one tool. It helps developers and enterprises secure, monitor, and govern AI agents in production.",
  },
  {
    q: "How long does setup take?",
    a: "Most users are scanning their first API collection within 5 minutes. Drop a Postman or OpenAPI collection, click Scan, and view findings immediately. For SDK integration, it's one line of code.",
  },
  {
    q: "What LLM providers do you support?",
    a: "We support OpenAI, Anthropic, Google Gemini, Cohere, Mistral, and Groq — with per-request cost tracking for all. We also isolate reasoning tokens (o1, o3, Claude) for exact cost attribution.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every new account gets a 14-day Pro trial automatically — no credit card required. You'll get unlimited collections, advanced scanning, team features, and Slack alerts during the trial.",
  },
  {
    q: "How does the kill switch work?",
    a: "You set budget caps, anomaly thresholds, or red-team scores. When any threshold is breached, DevPulse blocks all LLM API calls within milliseconds. You get alerted in Slack/Discord, and can reset manually or automatically.",
  },
  {
    q: "What compliance standards do you support?",
    a: "We map findings to OWASP API Top 10, OWASP LLM Top 10, PCI DSS v4.0.1, and SOC 2 Trust Services Criteria. Export evidence as JSON, CSV, or PDF for auditor review.",
  },
  {
    q: "Do you store our API data?",
    a: "We only store metadata (endpoint paths, auth methods, cost data). Request/response bodies are scanned in-memory and never persisted. For enterprises, we offer self-hosted deployment where nothing leaves your infrastructure.",
  },
  {
    q: "What is shadow API discovery?",
    a: "Shadow APIs are undocumented endpoints that exist in your codebase but not in your documentation. DevPulse statically analyzes your code (Express, FastAPI, Flask, Django, Spring Boot, Laravel) to find these hidden surfaces — no production traffic needed.",
  },
  {
    q: "Can I self-host DevPulse?",
    a: "Yes. We provide a Docker Compose setup and Kubernetes Helm chart for private cloud deployment. See our Self-Hosting Guide for step-by-step instructions. Enterprise plans include dedicated support for self-hosted deployments.",
  },
  {
    q: "How do I migrate from Helicone / Portkey / Lakera?",
    a: "Use our Import page at /import. We support direct migration from Helicone, Portkey, and Lakera Guard. Your historical data, collections, and settings transfer automatically.",
  },
  {
    q: "What happens if a payment fails?",
    a: "We send a retry email immediately. If it fails again, we warn you that one more failure will downgrade your account. After 3 failures in 30 days, you are automatically moved to the Free plan. No data loss — all your collections remain intact.",
  },
  {
    q: "Do you offer enterprise support?",
    a: "Yes. Enterprise plans include 4-hour SLA, dedicated Slack channel, quarterly business reviews, custom onboarding, and priority feature requests. Contact enterprise@devpulse.in for details.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-gray-400 mb-12">
          Everything you need to know about DevPulse. Can't find your question?{" "}
          <Link href="mailto:support@devpulse.in" className="text-blue-400 hover:text-blue-300">
            Email us
          </Link>
          .
        </p>

        <div className="space-y-6">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="font-bold text-lg mb-2 text-blue-400">{faq.q}</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
