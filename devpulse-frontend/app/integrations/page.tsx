import Link from "next/link";

export const metadata = {
  title: "Integrations — RakshEx Works With Your Stack",
  description:
    "RakshEx integrates with 20+ LLM providers, API frameworks, CI/CD pipelines, monitoring systems, and security tools.",
  alternates: { canonical: "/integrations" },
};

interface IntegrationItem {
  name: string;
  icon: string;
  status: "Available" | "Coming Soon";
}

interface IntegrationCategory {
  title: string;
  items: IntegrationItem[];
}

const CATEGORIES: IntegrationCategory[] = [
  {
    title: "LLM Providers",
    items: [
      { name: "OpenAI", icon: "🧠", status: "Available" },
      { name: "Anthropic Claude", icon: "🦉", status: "Available" },
      { name: "Google Gemini", icon: "♊", status: "Available" },
      { name: "Mistral", icon: "🌪️", status: "Coming Soon" },
      { name: "Cohere", icon: "🌿", status: "Coming Soon" },
      { name: "AWS Bedrock", icon: "🪨", status: "Coming Soon" },
    ],
  },
  {
    title: "API Frameworks",
    items: [
      { name: "FastAPI", icon: "⚡", status: "Available" },
      { name: "Express.js", icon: "🚂", status: "Available" },
      { name: "Fastify", icon: "🚀", status: "Coming Soon" },
      { name: "Django REST", icon: "🦄", status: "Coming Soon" },
      { name: "Spring Boot", icon: "🌱", status: "Coming Soon" },
      { name: "Laravel", icon: "🌶️", status: "Coming Soon" },
    ],
  },
  {
    title: "CI/CD Pipelines",
    items: [
      { name: "GitHub Actions", icon: "🐙", status: "Available" },
      { name: "GitLab CI", icon: "🦊", status: "Coming Soon" },
      { name: "CircleCI", icon: "⭕", status: "Coming Soon" },
      { name: "Jenkins", icon: "🤵", status: "Coming Soon" },
      { name: "Vercel", icon: "▲", status: "Coming Soon" },
    ],
  },
  {
    title: "Monitoring & Observability",
    items: [
      { name: "Datadog", icon: "🐕", status: "Coming Soon" },
      { name: "New Relic", icon: "📊", status: "Coming Soon" },
      { name: "Grafana", icon: "📈", status: "Coming Soon" },
      { name: "Prometheus", icon: "🔥", status: "Coming Soon" },
      { name: "PagerDuty", icon: "🚨", status: "Coming Soon" },
    ],
  },
  {
    title: "Communication Alerts",
    items: [
      { name: "Slack", icon: "💬", status: "Available" },
      { name: "Microsoft Teams", icon: "👥", status: "Coming Soon" },
      { name: "Email Notifications", icon: "✉️", status: "Coming Soon" },
    ],
  },
  {
    title: "Security & Testing",
    items: [
      { name: "Snyk", icon: "🛡️", status: "Coming Soon" },
      { name: "SonarQube", icon: "🔍", status: "Coming Soon" },
      { name: "OWASP ZAP", icon: "⚡", status: "Coming Soon" },
      { name: "Burp Suite", icon: "🥞", status: "Coming Soon" },
    ],
  },
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-900/60 mb-4">
            🔌 Ecosystem Connectivity
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Platform Integrations
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-base mt-3">
            Securely connect RakshEx with your primary model providers, API frameworks, security scanners, and alerts pipelines.
          </p>
        </header>

        {/* Categories loop */}
        <div className="space-y-16">
          {CATEGORIES.map((category) => (
            <section key={category.title}>
              <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-900 pb-3">
                {category.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {category.items.map((item) => (
                  <div
                    key={item.name}
                    className="p-5 bg-slate-900/30 border border-slate-900 hover:border-slate-800 rounded-2xl flex items-center justify-between gap-4 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-850">
                        {item.icon}
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-200 text-sm leading-tight">{item.name}</h3>
                      </div>
                    </div>

                    <span>
                      {item.status === "Available" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900/40 uppercase tracking-wider">
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-500 border border-slate-800 uppercase tracking-wider">
                          Coming Soon
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Request form or contact */}
        <div className="mt-20 p-8 rounded-2xl bg-slate-900/30 border border-slate-900 text-center max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-2">Need a custom integration?</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-lg mx-auto leading-relaxed">
            Our engineering team builds custom integrations for enterprise customers. Let us know what tools you are looking for.
          </p>
          <a
            href="mailto:akshay@rakshex.in?subject=Custom Integration Request"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-3 px-6 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            Request Custom Integration
          </a>
        </div>
      </div>
    </div>
  );
}
