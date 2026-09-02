import Link from "next/link";

export const metadata = {
  title: "RaksHex Incident Intelligence — AI Agent Failures, API Cost & Governance",
  description:
    "A source-backed intelligence center for consequential AI-agent incidents, API cost failures, MCP/tool risks, credential exposure and governance gaps.",
  alternates: { canonical: "https://rakshex.in/incidents" },
};

type Audience = "Solo Developer" | "Developer Team" | "Company / Startup" | "Enterprise / MNC";
type Impact = "Preventable" | "Reducible" | "Detectable" | "Outside current scope";
type Severity = "Critical" | "High" | "Medium";

type Incident = {
  id: string;
  date: string;
  audience: Audience;
  severity: Severity;
  topic: string;
  title: string;
  whatHappened: string;
  why: string;
  missingControl: string;
  rakshexImpact: Impact;
  control: string;
  source: string;
  sourceHref: string;
  analysisHref?: string;
};

const audiences: Audience[] = [
  "Solo Developer",
  "Developer Team",
  "Company / Startup",
  "Enterprise / MNC",
];

const topics = [
  "Cost & API bills",
  "Agent security",
  "MCP & tool control",
  "Credentials",
  "Identity & permissions",
  "Governance & audit",
  "Production actions",
];

const incidents: Incident[] = [
  {
    id: "RH-2026-0001",
    date: "Jul 2025 · retrospective",
    audience: "Company / Startup",
    severity: "Critical",
    topic: "Production actions",
    title: "A Replit coding agent deleted a production database during a code freeze.",
    whatHappened:
      "TechCrunch reported that the agent deleted a production database containing more than 100 executive contacts and later fabricated thousands of records.",
    why:
      "The agent retained effective authority over production despite an instruction not to make changes. Natural-language intent was not backed by a deterministic production boundary.",
    missingControl: "Hard production deny / approval boundary",
    rakshexImpact: "Reducible",
    control: "Action policy + approval + credential mediation",
    source: "TechCrunch · Oct 2, 2025 retrospective",
    sourceHref: "https://techcrunch.com/2025/10/02/after-nine-years-of-grinding-replit-finally-found-its-market-can-it-keep-it/",
    analysisHref: "/blog/replit-agent-production-database-incident",
  },
  {
    id: "RH-2026-0002",
    date: "Apr 22, 2026",
    audience: "Enterprise / MNC",
    severity: "High",
    topic: "MCP & tool control",
    title: "Microsoft documented a missing policy point before MCP tool execution.",
    whatHappened:
      "Microsoft's Agent Governance Toolkit research found a 26.67% policy-violation rate in its prompt-only internal red-team benchmark and described MCP as lacking a built-in pre-execution policy control plane.",
    why:
      "Prompt instructions can be interpreted inconsistently, while tool execution still needs deterministic authorization, trust checks and kill switches outside the model.",
    missingControl: "Pre-execution tool authorization",
    rakshexImpact: "Preventable",
    control: "Agent Firewall + argument-aware policy",
    source: "Microsoft for Developers · Apr 22, 2026",
    sourceHref: "https://developer.microsoft.com/blog/securing-mcp-a-control-plane-for-agent-tool-execution/",
    analysisHref: "/blog/microsoft-mcp-control-plane-2026",
  },
  {
    id: "RH-2026-0003",
    date: "Aug 2026 guidance",
    audience: "Enterprise / MNC",
    severity: "High",
    topic: "Identity & permissions",
    title: "Google Cloud warns that agent-only MCP execution is vulnerable to prompt injection and insecure tool chaining.",
    whatHappened:
      "Google Cloud's MCP security guidance says agent-only operation relies entirely on agent programming and is vulnerable to prompt injection, insecure tool chaining and naive error handling.",
    why:
      "An autonomous agent can combine individually legitimate tools into unsafe sequences when permissions are broad and no separate identity or approval boundary constrains it.",
    missingControl: "Agent-specific identity and least privilege",
    rakshexImpact: "Reducible",
    control: "Agent identity + delegated authority",
    source: "Google Cloud MCP security guidance · Aug 2026",
    sourceHref: "https://docs.cloud.google.com/mcp/ai-security-safety",
    analysisHref: "/blog/google-cloud-mcp-agent-identity-2026",
  },
  {
    id: "RH-2026-0004",
    date: "Jun 5 / Aug 17, 2026",
    audience: "Developer Team",
    severity: "High",
    topic: "Cost & API bills",
    title: "Cloudflare added AI spend limits that block requests after a budget is exhausted.",
    whatHappened:
      "AI Gateway now evaluates cost-based rules before provider requests and can return 429 when a scoped budget is exhausted.",
    why:
      "Token dashboards are observational. Autonomous workloads need a budget control on the execution path before the next paid request leaves the system.",
    missingControl: "Hard pre-execution budget boundary",
    rakshexImpact: "Preventable",
    control: "Budget policy + kill switch",
    source: "Cloudflare AI Gateway docs · updated Aug 17, 2026",
    sourceHref: "https://developers.cloudflare.com/ai-gateway/features/spend-limits/",
    analysisHref: "/blog/cloudflare-ai-spend-limits-2026",
  },
  {
    id: "RH-2026-0005",
    date: "Apr 2026",
    audience: "Solo Developer",
    severity: "Critical",
    topic: "Credentials",
    title: "A forgotten Google Cloud API key was abused for 60,000+ requests and an $18,000+ bill.",
    whatHappened:
      "Tom's Hardware reported that an exposed key left in a published Cloud Run project was abused for more than 60,000 requests, producing about US$18,391 in charges before the customer received relief.",
    why:
      "A reusable credential remained reachable and the provider-side budget configuration did not act as a hard real-time authorization boundary for the abused requests.",
    missingControl: "Short-lived credentials + enforced per-workload budget",
    rakshexImpact: "Reducible",
    control: "Credential mediation + budget policy + anomaly kill switch",
    source: "Tom's Hardware · Apr 2026",
    sourceHref: "https://www.tomshardware.com/tech-industry/artificial-intelligence/google-cloud-customer-wakes-up-to-usd18-000-bill-despite-usd7-budget-thanks-to-forgotten-public-api-key-attacker-put-in-60-000-requests-and-blasted-through-usd1-400-spending-cap",
    analysisHref: "/blog/google-cloud-api-key-18000-bill-2026",
  },
  {
    id: "RH-2026-0006",
    date: "Aug 5, 2026",
    audience: "Company / Startup",
    severity: "High",
    topic: "Governance & audit",
    title: "Cloudflare made AI Gateway identity-aware and added abnormal-usage detection.",
    whatHappened:
      "Cloudflare added verified Access identity to AI Gateway controls and User Insights that flags sessions with abnormal cost patterns against a user's recent baseline.",
    why:
      "Without trustworthy attribution, a gateway can see spend but cannot reliably answer which employee, service or agent created it or scope controls to that identity.",
    missingControl: "Verified caller identity + usage anomaly detection",
    rakshexImpact: "Detectable",
    control: "Agent identity + Action Ledger + spend policy",
    source: "Cloudflare AI Gateway changelog · Aug 5, 2026",
    sourceHref: "https://developers.cloudflare.com/changelog/product/ai-gateway/",
  },
  {
    id: "RH-2026-0007",
    date: "Aug 31, 2026",
    audience: "Enterprise / MNC",
    severity: "Medium",
    topic: "Governance & audit",
    title: "AWS made Agent Registry generally available for governed discovery of agents, tools, skills and MCP servers.",
    whatHappened:
      "AWS Agent Registry now provides an organization-wide governed catalog, approval workflows, CloudTrail audit trails and cross-account sharing for agentic assets.",
    why:
      "As agent ecosystems grow, teams can otherwise invoke untracked or duplicate tools and MCP servers without a central approval and inventory surface.",
    missingControl: "Approved asset registry + audit trail",
    rakshexImpact: "Detectable",
    control: "Tool registry policy + Action Ledger",
    source: "AWS What's New · Aug 31, 2026",
    sourceHref: "https://aws.amazon.com/about-aws/whats-new/2026/08/aws-agent-registry-generally-available/",
  },
  {
    id: "RH-2026-0008",
    date: "Aug 18, 2026",
    audience: "Enterprise / MNC",
    severity: "High",
    topic: "MCP & tool control",
    title: "F5 moved model, MCP and guardrail policy into one enterprise AI control plane.",
    whatHappened:
      "F5 announced an enhanced AI Gateway that centralizes model routing, token budgets, MCP agent-to-tool access controls, guardrails and auditability.",
    why:
      "Separate point tools leave gaps between who may use a model, what an agent may execute, what it may spend and how the action is audited.",
    missingControl: "Unified policy enforcement across model and tool execution",
    rakshexImpact: "Outside current scope",
    control: "RaksHex overlaps at action authorization, budgets and audit; it does not replace a full model gateway",
    source: "F5 press release · Aug 18, 2026",
    sourceHref: "https://www.f5.com/company/news/press-releases/f5-unleashes-next-generation-agentic-ready-ai-gateway-to-optimize-the-economics-and-governance-of-enterprise-ai-costs",
  },
  {
    id: "RH-2026-0009",
    date: "Mar 11, 2026",
    audience: "Developer Team",
    severity: "High",
    topic: "Agent security",
    title: "OpenAI describes prompt injection as an evolving risk for agents that can browse and act.",
    whatHappened:
      "OpenAI documented how instructions embedded in external content can manipulate agents and said effective attacks increasingly resemble social engineering.",
    why:
      "An agent must process untrusted text and trusted user intent in the same reasoning context, so malicious content can influence later tool choices.",
    missingControl: "Independent authorization after model reasoning",
    rakshexImpact: "Reducible",
    control: "Action policy + argument constraints + approval for consequential actions",
    source: "OpenAI · Mar 11, 2026",
    sourceHref: "https://openai.com/index/designing-agents-to-resist-prompt-injection/",
  },
  {
    id: "RH-2026-0010",
    date: "Mar 25, 2026",
    audience: "Solo Developer",
    severity: "High",
    topic: "Production actions",
    title: "Anthropic says Claude Code users approve 93% of permission prompts, creating approval-fatigue pressure.",
    whatHappened:
      "Anthropic published its rationale for Claude Code auto mode after observing that users approve the overwhelming majority of permission prompts and may stop reading them carefully.",
    why:
      "All-or-nothing approval flows force a bad tradeoff between constant clicking and unrestricted execution; risk-sensitive authorization needs more context than a generic prompt.",
    missingControl: "Risk-based action authorization",
    rakshexImpact: "Reducible",
    control: "Semantic action policy + scoped approvals",
    source: "Anthropic Engineering · Mar 25, 2026",
    sourceHref: "https://www.anthropic.com/engineering/claude-code-auto-mode",
    analysisHref: "/blog/claude-code-approval-fatigue-action-policy-2026",
  },
  {
    id: "RH-2026-0011",
    date: "Current guidance",
    audience: "Developer Team",
    severity: "High",
    topic: "Agent security",
    title: "OWASP recommends token, cost, retry and tool-chain limits for production agents.",
    whatHappened:
      "OWASP's AI Agent Security Cheat Sheet calls out recursive tool abuse, unrestricted permissions and high-impact actions without human oversight as explicit agent security failure modes.",
    why:
      "Retries, recursion and tool chaining can amplify a single model error into financial, operational or security damage when no deterministic bound stops execution.",
    missingControl: "Circuit breakers + least privilege + human oversight",
    rakshexImpact: "Preventable",
    control: "Budget/retry policy + action authorization + approval",
    source: "OWASP AI Agent Security Cheat Sheet",
    sourceHref: "https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html",
  },
  {
    id: "RH-2026-0012",
    date: "2026 guidance",
    audience: "Enterprise / MNC",
    severity: "High",
    topic: "MCP & tool control",
    title: "AWS recommends an approved tool registry with invocation-time enforcement.",
    whatHappened:
      "AWS Well-Architected agent guidance says every reachable tool is part of the agent's effective privilege surface and recommends a version-controlled approved registry enforced at invocation time.",
    why:
      "Dynamic discovery can place unvetted, deprecated or overprivileged tools on an agent's call path unless approval is enforced where invocation happens.",
    missingControl: "Approved tool registry enforced at call time",
    rakshexImpact: "Preventable",
    control: "Tool allowlist + per-call policy",
    source: "AWS Well-Architected Agentic AI Lens",
    sourceHref: "https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentsec02-bp03.html",
  },
  {
    id: "RH-2026-0013",
    date: "Aug 11, 2026",
    audience: "Company / Startup",
    severity: "High",
    topic: "MCP & tool control",
    title: "Permit.io frames MCP servers as operational control surfaces that need runtime authorization.",
    whatHappened:
      "Permit.io's enterprise MCP guidance recommends RBAC at identity boundaries, runtime policy at execution boundaries, throttling for abuse, audit logs and human approval for irreversible actions.",
    why:
      "Once an MCP server can alter cloud infrastructure, credentials or access, tool connectivity becomes an authorization problem rather than only an integration problem.",
    missingControl: "Identity-bound runtime authorization",
    rakshexImpact: "Preventable",
    control: "Delegated authority + per-action policy + approval + ledger",
    source: "Permit.io · Aug 11, 2026",
    sourceHref: "https://www.permit.io/blog/govern-ai-agents-cloud-api-control-planes-mcp",
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
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-5">How autonomous systems fail in the real world.</h1>
          <p className="text-slate-400 text-lg leading-8">
            A source-backed record of consequential AI-agent incidents and control-plane changes. Each record identifies what happened, why the control failed, and whether the current RaksHex model could prevent, reduce, detect, or not address the failure.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-800 px-3 py-1.5 text-slate-400">{incidents.length} verified records</span>
            <span className="rounded-full border border-slate-800 px-3 py-1.5 text-slate-400">Primary sources preferred</span>
            <span className="rounded-full border border-slate-800 px-3 py-1.5 text-slate-400">No infinite feed</span>
          </div>
        </header>

        <nav className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6" aria-label="Incident audiences">
          {audiences.map((audience) => {
            const count = incidents.filter((incident) => incident.audience === audience).length;
            return (
              <a key={audience} href={`#${audience.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="rounded-xl border border-[#1A1F2E] bg-black/35 p-4 hover:border-[#14B8A6]/40 transition-colors">
                <div className="text-sm font-semibold text-white">{audience}</div>
                <div className="text-xs text-slate-500 mt-1">{count} verified record{count === 1 ? "" : "s"}</div>
              </a>
            );
          })}
        </nav>

        <div className="flex flex-wrap gap-2 mb-10" aria-label="Topic menu">
          {topics.map((topic) => <span key={topic} className="rounded-full border border-slate-800 px-3 py-1.5 text-xs text-slate-400">{topic}</span>)}
        </div>

        <div className="grid xl:grid-cols-[1fr_320px] gap-10 items-start">
          <div className="space-y-12">
            {audiences.map((audience) => {
              const audienceIncidents = incidents.filter((incident) => incident.audience === audience);
              return (
                <section key={audience} id={audience.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="scroll-mt-28">
                  <div className="flex items-end justify-between gap-4 mb-4">
                    <div><p className="text-xs uppercase tracking-[0.18em] text-[#5eead4]">Audience</p><h2 className="text-2xl font-semibold mt-1">{audience}</h2></div>
                    <span className="text-xs text-slate-500">{audienceIncidents.length} verified</span>
                  </div>
                  <div className="space-y-4">
                    {audienceIncidents.map((incident) => (
                      <article key={incident.id} className="rounded-2xl border border-[#1A1F2E] bg-black/30 p-6 md:p-7">
                        <div className="flex flex-wrap items-center gap-2 text-xs mb-4">
                          <span className="font-mono text-slate-500">{incident.id}</span><span className="text-slate-700">·</span><span className="text-slate-400">{incident.date}</span><span className="text-slate-700">·</span><span className="text-[#5eead4]">{incident.topic}</span>
                          <span className="ml-auto rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-300">{incident.severity}</span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-semibold leading-snug">{incident.title}</h3>
                        <div className="grid lg:grid-cols-2 gap-3 mt-5 text-sm">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500 mb-1">What happened</p><p className="text-slate-300 leading-6">{incident.whatHappened}</p></div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500 mb-1">Why it happened / matters</p><p className="text-slate-300 leading-6">{incident.why}</p></div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-3 mt-3 text-sm">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs text-slate-500 mb-1">Missing control</p><p className="text-slate-200">{incident.missingControl}</p></div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs text-slate-500 mb-1">Relevant RaksHex control</p><p className="text-slate-200">{incident.control}</p></div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-xs text-slate-500 mb-2">RaksHex impact</p><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${impactStyle[incident.rakshexImpact]}`}>{incident.rakshexImpact}</span></div>
                        </div>
                        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                          <a href={incident.sourceHref} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white underline underline-offset-4">Source: {incident.source}</a>
                          {incident.analysisHref && <Link href={incident.analysisHref} className="text-[#5eead4] hover:underline">Read RaksHex analysis →</Link>}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-28">
            <div className="rounded-2xl border border-[#14B8A6]/25 bg-[#14B8A6]/5 p-6"><h2 className="font-semibold">Could RaksHex have stopped this?</h2><p className="mt-2 text-sm text-slate-400 leading-6">We do not force every story into a product pitch. Each record is labelled Preventable, Reducible, Detectable, or Outside current scope based on the control actually involved.</p></div>
            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6"><h2 className="font-semibold mb-3">How to read the labels</h2><div className="space-y-3 text-sm text-slate-400"><p><strong className="text-emerald-300">Preventable:</strong> an enforced RaksHex policy directly matches the failure path, assuming traffic is routed through RaksHex.</p><p><strong className="text-amber-300">Reducible:</strong> RaksHex can narrow blast radius or require approval, but cannot guarantee the event disappears.</p><p><strong className="text-sky-300">Detectable:</strong> identity, spend or ledger evidence can help surface the event; prevention is not proven.</p><p><strong className="text-slate-300">Outside current scope:</strong> the capability belongs to a broader gateway, platform or security layer RaksHex does not claim to replace.</p></div></div>
            <div className="rounded-2xl border border-[#1A1F2E] bg-black/40 p-6"><h2 className="font-semibold mb-2">Research, not a fear feed</h2><p className="text-sm text-slate-400 leading-6">Records require a credible source, a concrete failure mode, and a control lesson. Viral numbers without traceable evidence are excluded.</p><Link href="/blog" className="inline-block mt-4 text-sm text-[#5eead4] hover:underline">Open long-form analysis →</Link></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
