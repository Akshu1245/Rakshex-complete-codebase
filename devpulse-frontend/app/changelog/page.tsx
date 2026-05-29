import Link from "next/link";

export const metadata = {
  title: "Changelog — RakshEx Product Updates",
  description:
    "Track every update, feature, and improvement to RakshEx. See what's new, what changed, and what's coming next.",
  alternates: { canonical: "/changelog" },
};

interface ChangelogItem {
  type: "added" | "improved" | "fixed";
  text: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  items: ChangelogItem[];
}

const ENTRIES: ChangelogEntry[] = [
  {
    version: "v0.4.0",
    date: "May 2026",
    items: [
      { type: "added", text: "Interactive demo scanner with Postman collection upload" },
      { type: "added", text: "Waitlist system with email confirmation" },
      { type: "fixed", text: "All navigation dead links resolved" },
      { type: "fixed", text: "Google OAuth pointing to production endpoint" },
      { type: "improved", text: "About page now reflects full founding team" },
    ],
  },
  {
    version: "v0.3.0",
    date: "April 2026",
    items: [
      { type: "added", text: "AgentGuard kill switch engine" },
      { type: "added", text: "Four provisional patents filed (NHCE/DEV/2026/001–004)" },
      { type: "added", text: "VS Code extension alpha (devpulse integration)" },
      { type: "improved", text: "Pricing page with Pro and Enterprise tiers" },
    ],
  },
  {
    version: "v0.2.0",
    date: "March 2026",
    items: [
      { type: "added", text: "LLM cost intelligence dashboard" },
      { type: "added", text: "Thinking token attribution engine" },
      { type: "added", text: "Multi-provider support (OpenAI, Anthropic, Gemini)" },
      { type: "improved", text: "Dashboard performance 40% faster" },
    ],
  },
  {
    version: "v0.1.0",
    date: "February 2026",
    items: [
      { type: "added", text: "Initial private beta launch" },
      { type: "added", text: "API security scanner core engine" },
      { type: "added", text: "OWASP AI Top 10 detection rules" },
      { type: "added", text: "Postman collection import" },
    ],
  },
];

const BADGE_STYLE: Record<string, string> = {
  added: "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40",
  improved: "bg-teal-950/60 text-teal-accent border border-teal-accent/20",
  fixed: "bg-slate-900/60 text-slate-400 border border-slate-700/40",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8 font-sans selection:bg-teal-accent selection:text-black">
      <div className="max-w-3xl mx-auto">
        <header className="mb-16 pb-6 border-b border-neutral-900">
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-manrope">
            Changelog
          </h1>
          <p className="text-neutral-400 mt-2 text-base">
            Track product updates, early releases, and the evolution of the RakshEx AI governance
            framework.
          </p>
        </header>

        {/* Timeline Layout */}
        <div className="relative border-l border-neutral-800 ml-4 space-y-12">
          {ENTRIES.map((entry) => (
            <div key={entry.version} className="relative pl-8">
              {/* Bullet node on timeline */}
              <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-teal-accent bg-[#0F0F0F] shadow-sm" />

              <div className="flex flex-wrap items-baseline gap-3 mb-4">
                <span className="text-2xl font-bold text-white font-mono">{entry.version}</span>
                <span className="text-neutral-500 text-sm">{entry.date}</span>
              </div>

              <ul className="space-y-4">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 mt-0.5 ${
                        BADGE_STYLE[item.type]
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-neutral-300 text-sm leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Coming soon section */}
        <div className="mt-16 p-8 bg-[#141414] border border-neutral-850 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4">Under Development</h3>
          <ul className="text-neutral-400 text-sm space-y-3">
            <li className="flex items-center gap-2">
              <span className="text-teal-accent font-bold">•</span>
              Stripe integration for global customer billing
            </li>
            <li className="flex items-center gap-2">
              <span className="text-teal-accent font-bold">•</span>
              Slack integration for real-time security incident alerts
            </li>
            <li className="flex items-center gap-2">
              <span className="text-teal-accent font-bold">•</span>
              Advanced machine-learning classifiers for custom model prompt evaluations
            </li>
            <li className="flex items-center gap-2">
              <span className="text-teal-accent font-bold">•</span>
              Visual drag-and-drop rule builder to customize runtime policies
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
