import Link from "next/link";

export const metadata = {
  title: "FAQ — RakshEx AI Governance Platform",
  description:
    "Frequently asked questions about RakshEx pricing, security, compliance, setup, and enterprise features.",
  alternates: { canonical: "/faq" },
};

const FAQS = [
  {
    q: "How long does setup take?",
    a: "Setup takes less than 5 minutes. You can import your Postman or OpenAPI collection to start scanning immediately, or integrate our SDK with a single line of code.",
  },
  {
    q: "Do you store our API data?",
    a: "No. We do not store request or response bodies. All security scanning and PII detection is performed in-memory, and only metadata (such as paths, latency, and token counts) is persisted. For strict privacy requirements, we offer self-hosted deployment.",
  },
  {
    q: "What compliance standards do you support?",
    a: "We support major frameworks including PCI DSS v4.0.1, SOC 2 Type II (Trust Services Criteria), HIPAA, OWASP API Top 10, and OWASP LLM Top 10.",
  },
  {
    q: "How does the kill switch work?",
    a: "You can configure budget thresholds, anomaly detection scores, or prompt injection blocks. When a policy is violated, RakshEx blocks further API calls to the LLM within milliseconds, preventing cost overruns and data leaks.",
  },
  {
    q: "What LLM providers do you support?",
    a: "We support all major providers, including OpenAI, Anthropic, Google Gemini, Cohere, Mistral, Groq, and AWS Bedrock.",
  },
  {
    q: "How is RakshEx different from Snyk or Datadog?",
    a: "Snyk scans static code dependencies, and Datadog provides general APM metrics. RakshEx is built specifically for AI runtime governance—analyzing LLM inputs/outputs in real-time, detecting prompt injections, managing token budgets, and mapping anomalies to compliance clauses.",
  },
  {
    q: "Do you support self-hosted deployment?",
    a: "Yes. We offer a Docker Compose setup and Kubernetes Helm chart for self-hosting within your private cloud or on-premise infrastructure.",
  },
  {
    q: "What happens when I exceed my plan limits?",
    a: "When you approach your plan limits, we send warning notifications. If you exceed them, we provide a grace period depending on your plan. For continued high usage, your account will be capped or you will be prompted to upgrade to a higher tier.",
  },
  {
    q: "How does thinking token attribution work?",
    a: "For models with reasoning tokens (like OpenAI o1/o3 or DeepSeek R1), RakshEx parses the raw API response, isolates the thinking tokens, and attributes their exact cost separately from standard output tokens.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "Yes. We offer a 14-day free trial for the Pro plan, with no credit card required. You can experience advanced scanning, Slack alerts, and team features immediately.",
  },
  {
    q: "Can I export compliance reports?",
    a: "Yes. You can export complete, auditor-ready compliance reports and raw scan evidence in PDF, JSON, and CSV formats.",
  },
  {
    q: "How do I integrate with GitHub Actions?",
    a: "You can use our official GitHub Action to automatically scan API collections and check for security regressions or shadow endpoints as part of your CI/CD pipeline.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-24 px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 font-display text-blue-500">Frequently Asked Questions</h1>
        <p className="text-gray-400 mb-12 font-mono text-sm">
          Everything you need to know about RakshEx. Can't find your question?{" "}
          <Link href="mailto:support@rakshex.in" className="text-blue-400 hover:text-blue-300 underline">
            Email us
          </Link>
          .
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 hover:border-blue-500/30 transition-all flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg mb-3 text-blue-400">{faq.q}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
