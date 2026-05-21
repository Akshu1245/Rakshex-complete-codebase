export const metadata = {
  title: "Changelog — Rakshex Product Updates",
  description:
    "Track every update, feature, and improvement to Rakshex. See what's new, what changed, and what's coming next.",
  alternates: { canonical: "/changelog" },
};

const ENTRIES = [
  {
    date: "May 2026",
    version: "v1.2.0",
    items: [
      { type: "feature", text: "14-day Pro trial for all new signups" },
      {
        type: "feature",
        text: "Dunning management — retry emails and auto-downgrade after 3 failed payments",
      },
      {
        type: "feature",
        text: "Competitor import system (Helicone, Portkey, Lakera, LangSmith, CSV/JSON)",
      },
      { type: "feature", text: "ROI calculator for prospects" },
      { type: "improvement", text: "Enhanced landing page with comparison table and trust badges" },
      { type: "improvement", text: "Blog SEO posts for competitor alternatives" },
      { type: "fix", text: "Fixed hydration mismatch on landing page JSON-LD" },
    ],
  },
  {
    date: "April 2026",
    version: "v1.1.0",
    items: [
      { type: "feature", text: "Razorpay integration for India payments" },
      { type: "feature", text: "Billing portal with subscription management and invoice history" },
      { type: "feature", text: "Kill switch autonomous circuit breaker" },
      { type: "feature", text: "Red team scheduler with 87-payload library" },
      { type: "improvement", text: "VS Code extension v1.0 published to marketplace" },
      { type: "improvement", text: "GitHub Action with PR comments and severity badges" },
    ],
  },
  {
    date: "March 2026",
    version: "v1.0.0",
    items: [
      { type: "feature", text: "Security scanner with OWASP API Top 10 mapping" },
      { type: "feature", text: "LLM cost monitoring for 6 providers" },
      { type: "feature", text: "Shadow API discovery for 6 frameworks" },
      { type: "feature", text: "Compliance report export (JSON, CSV, PDF)" },
      { type: "feature", text: "Enterprise SSO with SAML 2.0 and OIDC" },
      { type: "feature", text: "Team workspaces with RBAC" },
    ],
  },
];

const BADGE: Record<string, string> = {
  feature: "bg-green-900/50 text-green-400",
  improvement: "bg-blue-900/50 text-blue-400",
  fix: "bg-amber-900/50 text-amber-400",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Changelog</h1>
        <p className="text-gray-400 mb-12">What's new in Rakshex. Updated with every release.</p>

        <div className="space-y-12">
          {ENTRIES.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-xl font-bold">{entry.version}</h2>
                <span className="text-gray-500 text-sm">{entry.date}</span>
              </div>
              <ul className="space-y-3">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5 ${
                        BADGE[item.type]
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-gray-300 text-sm">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h3 className="font-bold mb-2">Coming Soon</h3>
          <ul className="text-gray-400 text-sm space-y-2">
            <li>• Stripe integration for global payments</li>
            <li>• Slack bot for real-time alerts</li>
            <li>• ML-based prompt injection classifier (Phase 3)</li>
            <li>• Custom policy builder (drag-and-drop YAML)</li>
            <li>• Dashboard analytics with export</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
