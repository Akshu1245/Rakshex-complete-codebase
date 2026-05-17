import Link from "next/link";

export const metadata = {
  title: "Integrations — DevPulse Works With Your Stack",
  description:
    "DevPulse integrates with 20+ tools: VS Code, GitHub, Slack, Discord, Postman, OpenAI, Anthropic, Gemini, and more.",
  alternates: { canonical: "/integrations" },
};

const INTEGRATIONS = [
  {
    category: "LLM Providers",
    items: ["OpenAI", "Anthropic", "Google Gemini", "Cohere", "Mistral", "Groq"],
  },
  {
    category: "IDEs & Editors",
    items: ["VS Code", "Cursor", "JetBrains", "Vim/Neovim (via CLI)"],
  },
  {
    category: "CI/CD",
    items: ["GitHub Actions", "GitLab CI", "CircleCI", "Jenkins", "Travis CI", "Azure DevOps"],
  },
  {
    category: "API Tools",
    items: ["Postman", "Bruno", "Insomnia", "OpenAPI/Swagger", "GraphQL", "gRPC"],
  },
  {
    category: "Communication",
    items: ["Slack", "Discord", "Microsoft Teams", "Email (SMTP)"],
  },
  {
    category: "Cloud Providers",
    items: ["AWS", "Google Cloud", "Azure", "Vercel", "Render", "Railway", "DigitalOcean"],
  },
  {
    category: "Identity & SSO",
    items: [
      "Okta",
      "Google Workspace",
      "Microsoft Entra",
      "Azure AD",
      "OneLogin",
      "SAML 2.0",
      "OIDC",
    ],
  },
  {
    category: "Frameworks",
    items: [
      "Express.js",
      "FastAPI",
      "Flask",
      "Django",
      "Spring Boot",
      "Laravel",
      "Next.js",
      "NestJS",
    ],
  },
  {
    category: "Monitoring",
    items: ["Sentry", "Datadog", "New Relic", "Grafana", "Prometheus"],
  },
  {
    category: "Compliance",
    items: ["Vanta", "Drata", "Secureframe", "Lacework", "Wiz"],
  },
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="text-center py-20 px-4 border-b border-gray-800">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Works With Your Stack</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          DevPulse integrates with the tools you already use. No migration needed. No retraining
          required.
        </p>
      </div>

      <div className="max-w-5xl mx-auto py-16 px-4">
        <div className="grid md:grid-cols-2 gap-8">
          {INTEGRATIONS.map((section) => (
            <div
              key={section.category}
              className="bg-gray-800 p-6 rounded-xl border border-gray-700"
            >
              <h2 className="text-lg font-bold mb-4 text-blue-400">{section.category}</h2>
              <div className="flex flex-wrap gap-2">
                {section.items.map((item) => (
                  <span
                    key={item}
                    className="bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center py-16 border-t border-gray-800">
        <h2 className="text-2xl font-bold mb-4">Don't see your tool?</h2>
        <p className="text-gray-400 mb-6">
          We add new integrations every week. Request yours and we'll prioritize it.
        </p>
        <Link
          href="mailto:support@devpulse.in?subject=Integration Request"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Request Integration →
        </Link>
      </div>
    </div>
  );
}
