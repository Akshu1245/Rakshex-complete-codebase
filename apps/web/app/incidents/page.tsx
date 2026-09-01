import Link from "next/link";

export const metadata = {
  title: "RaksHex Incident Intelligence — AI Agent Failures, API Cost & Governance",
  description:
    "A source-backed intelligence center for consequential AI-agent incidents, API cost failures, MCP/tool risks, credential exposure and governance gaps.",
  alternates: { canonical: "https://rakshex.in/incidents" },
};

type Audience = "Solo Developer" | "Developer Team" | "Company / Startup" | "Enterprise / MNC";
type Impact = "Preventable" | "Reducible" | "Detectable" | "Outside current scope";

type Incident = {
  id: string;
  date: string;
  audience: Audience;
  severity: "Critical" | "High" | "Medium";
  topic: string;
  title: string;
  summary: string;
  missingControl: string;
  rakshexImpact: Impact;
  control: string;
  href: string;
};

const audiences: Audience[] = [
  "Solo Developer",
  "Developer Team",
  "Company / Startup",
  "Enterprise / MNC",
];

const incidents: Incident[] = [
  {
    id: "RH-2026-0001",
    date: "Jul 2025 · retrospective",
    audience: "Company / Startup",
    severity: "Critical",
    topic: "Production action",
    title: "An AI coding agent deleted a production database during a code freeze.",
    summary:
      "The incident is a clean example of why natural-language instructions are weaker than enforceable production boundaries.",
    missingControl: "Hard production deny / approval boundary",
    rakshexImpact: "Reducible",
    control: "Action policy + approval + credential mediation",
    href: "/blog/replit-agent-production-database-incident",
  },
  {
    id: "RH-2026-0002",
    date: "Apr 2026",
    audience: "Enterprise / MNC",
    severity: "High",
    topic: "MCP & tool control",
    title: "Microsoft identified a missing policy point before MCP tool execution.",
    summary:
      "MCP standardizes tool execution, but authorization and governance still need an external enforcement layer before a consequential call runs.",
    missingControl: "Pre-execution tool authorization",
    rakshexImpact: "Preventable",
    control: "Agent Firewall + argument-aware policy",
    href: "/blog/microsoft-mcp-control-plane-2026",
  },
  {
    id: "RH-2026-0003",
    date: "2026 guidance",
    audience: "Enterprise / MNC",
    severity: "High",
    topic: "Identity & permissions",
    title: "Google Cloud guidance treats AI agents as identities that need least privilege.",
    summary:
      "Dedicated agent identity narrows blast radius and makes policy decisions attributable to the workload actually taking the action.",
    missingControl: "Agent-specific identity and least privilege",
    rakshexImpact: "Reducible",
    control: "Agent identity + delegated authority",
    href: "/blog/google-cloud-mcp-agent-identity-2026",
  },
  {
    id: "RH-2026-0004",
    date: "Aug 2026",
    audience: "Developer Team",
    severity: "High",
    topic: "Cost & API bills",
    title: "Cloudflare added hard AI spend limits that can block requests after a budget is exhausted.",
    summary:
      "The feature validates a basic rule for autonomous systems: cost controls have to sit on the execution path, not only in a dashboard viewed later.",
    missingControl: "Hard pre-execution budget boundary",
    rakshexImpact: "Preventable",
    control: "Budget policy + kill switch",
    href: "/blog/cloudflare-ai-spend-limits-2026",
  },
];

const impactStyle: Record<Impact, string> = {
  Preventable: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Reducible: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  Detectable: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  "Outside current scope": "border-slate-700 bg-slate-900 text-slate-400",
};

export default function IncidentIntelligencePage() {
  return (
    <main className="min-h-screen bg-transparent text-white pt-28 pb-20 px-6 xl:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="max-w-4xl mb-10">
          <p className="text-[#14B8A6] text-sm font-medium mb-3">RaksHex Incident Intelligence</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-5">
            How autonomous systems fail in the real world.
          </h1>
          <p className="text-slate-400 text-lg leading-8">
            A source-backed record of consequential AI-agent incidents and control-plane changes. Each record identifies the missing control and states, without overclaiming, whether the current RaksHex model could prevent, reduce, detect, or not address the failure.
          </p>
        </header>

        <nav className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10" aria-label="Incident audiences">
          {audiences.map((audience) => {
            const count = incidents.filter((incident) => incident.audience === audience).length;
            return (
              <a
                key={audience}
                href={`#${audience.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="rounded-xl border border-[#1A1F2E] bg-black/35 p-4 hover:border-[#14B8A6]/40 transition-colors"
              >
                <div className="text-sm font-semibold text-white">{audience}</div>
                <div className="text-xs text-slate-500 mt-1">{count} verified record{count === 1 ? "" : "s"} in this seed</div>
              </a>
            );
          })}
        </nav>

        <div className="grid xl:grid-cols-[1fr_320px] gap-10 items-start">
          <div className="space-y-12">
            {audiences.map((audience) => {
              const audienceIncidents = incidents.filter((incident) => incident.audience === audience);
              return (
                <section
                  key={audience}
                  id={audience.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                  className="scroll-mt-28"
                >
                  <div className="flex items-end justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#5eead4]">Audience</p>
                      <h2 className="text-2xl font-semibold mt-1">{audience}</h2>
                    </div>
                    <span className="text-xs text-slate-500">{audienceIncidents.length} verified</span>
                  </div>

                  {audienceIncidents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                      No record is published here until the underlying incident is source-verified.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {audienceIncidents.map((incident) => (
                        <article key={incident.id} className="rounded-2xl border border-[#1A1F2E] bg-black/30 p-6 md:p-7">
                          <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
                            <span className="font-mono text-slate-500">{incident.id}</span>
                            <span className="text-slate-700">·</span>
                            <span className="text-slate-400">{incident.date}</span>
                            <span className="text-slate-700">·</span>
                            <span className="text-[#5eead4]">{incident.topic}</span>
                            <span className="ml-auto rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-300">
                              {incident.severity}
                            </span>
                          </div>

                          <h3 className="text-xl md:text-2xl font-semibold leading-snug">{incident.title}</h3>
                          <p className="mt-3 text-slate-400 leading-7">{incident.summary}</p>

                          <div className="grid md:grid-cols-3 gap-3 mt-6 text-sm">
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                              <p className="text-xs text-slate-500 mb-1">Missing control</p>
                              <p className="text-slate-200">{incident.missingControl}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                              <p className="text-xs text-slate-500 mb-1">Relevant RaksHex control</p>
                              <p className="text-slate-200">{incident.control}</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                              <p className="text-xs text-slate-500 mb-2">RaksHex impact</p>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${impactStyle[incident.rakshexImpact]}`}>
                                {incident.rakshexImpact}
                              </span>
                            </div>
                          </div>

                          <Link href={incident.href} className="inline-block mt-5 text-sm text-[#5eead4] hover:underline">
                            Read source-backed analysis →
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-28">
            <div className="rounded-2xl border border-[#14B8A6]/25 bg-[#14B8A6]/5 p-6">
              <h2 className="font-semibold">Could RaksHex have stopped this?</h2>
              <p className="mt-2 text-sm text-slate-400 leading-6">
                We do not force every story into a product pitch. Each record is labelled Preventable, Reducible, Detectable, or Outside current scope based on the control actually involved.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6">
              <h2 className="font-semibold mb-3">Topic menus</h2>
              <div className="space-y-2 text-sm text-slate-400">
                {[
                  "Cost & API bills",
                  "Agent security",
                  "MCP & tool control",
                  "Credentials",
                  "Identity & permissions",
                  "Governance & audit",
                  "Production actions",
                ].map((topic) => (
                  <div key={topic} className="rounded-lg border border-slate-800 px-3 py-2">{topic}</div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6">
              <h2 className="font-semibold mb-2">Research, not a fear feed</h2>
              <p className="text-sm text-slate-400 leading-6">
                Records require a credible source, a concrete failure mode, and a control lesson. Viral numbers without traceable evidence are excluded.
              </p>
              <Link href="/blog" className="inline-block mt-4 text-sm text-[#5eead4] hover:underline">
                Open long-form analysis →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
