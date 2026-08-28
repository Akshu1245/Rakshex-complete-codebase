export interface DocPage {
  title: string;
  breadcrumb: string;
  lead: string;
  contentHtml: string;
}

export const docsData: Record<string, DocPage> = {
  "quickstart/cli": {
    title: "CLI scan",
    breadcrumb: "Getting Started / Optional surface",
    lead: "The CLI exists in this repository but is not advertised as a public npm install during private beta.",
    contentHtml: `
      <p>The CLI source lives at <code>apps/cli</code>. Use it from a checked-out RaksHex repository while the package is private-beta source rather than inventing a public registry command.</p>
      <pre><code>pnpm install --frozen-lockfile
pnpm --filter @rakshex/cli exec -- --help</code></pre>
      <p>For the strategic runtime-control hello-world, start with the <a href="/docs/agent-firewall">Agent Firewall</a>.</p>
    `,
  },

  "quickstart/vscode": {
    title: "VS Code extension",
    breadcrumb: "Getting Started / Optional surface",
    lead: "The editor extension is implemented and packageable; public Marketplace availability must be verified separately.",
    contentHtml: `
      <p>The extension source lives at <code>apps/vscode-extension</code>. It supports workspace scanning/findings workflows and stores its RaksHex credential through VS Code SecretStorage.</p>
      <h2>Private-beta installation</h2>
      <p>Build/package a VSIX from the exact release commit, then install that artifact in VS Code. Do not assume a Marketplace listing exists until the external listing has actually been published and checked.</p>
      <pre><code>pnpm install --frozen-lockfile
pnpm --filter rakshex-vscode typecheck
pnpm --filter rakshex-vscode test
pnpm --filter rakshex-vscode build
cd apps/vscode-extension
pnpm dlx @vscode/vsce package --out rakshex-vscode-local.vsix</code></pre>
      <h2>Connect</h2>
      <p>Point the extension at the intended beta/staging API and use a RaksHex workspace API key created by the product. Provider API secrets do not belong in extension settings.</p>
      <p>See <code>apps/vscode-extension/PUBLISHING.md</code> for the verified publishing workflow.</p>
    `,
  },

  "quickstart/mcp": {
    title: "MCP security & governance",
    breadcrumb: "Getting Started / Optional surface",
    lead: "RaksHex contains MCP security inventory/governance code; it does not advertise an unverified public npx MCP-server package.",
    contentHtml: `
      <p>The repository includes <code>@rakshex/mcp-security</code> plus API-side MCP governance. These surfaces are used to inventory and assess MCP/tool risk and to attach governance findings to workspace state.</p>
      <p>There is currently no public installation claim here for <code>@rakshex/mcp-server</code>. If you are evaluating the private-beta MCP work, use the checked-out repository and the procedures exposed by the current API instead of copying an invented registry command.</p>
      <h2>Boundary</h2>
      <p>MCP security analysis does not by itself mean RaksHex universally proxies or blocks every MCP tool call. Enforcement depends on the path actually integrated with RaksHex.</p>
    `,
  },

  "security-scanner": {
    title: "Security scanner",
    breadcrumb: "Products / Security",
    lead: "Deterministic collection and developer-workflow scanning with evidence-backed findings.",
    contentHtml: `
      <p>RaksHex parses supported API collection/spec inputs and runs deterministic rules from <code>@rakshex/scanner-core</code>. Findings are persisted and surfaced through supported web, CLI, VS Code and GitHub workflows.</p>
      <h2>What a finding means</h2>
      <p>A scanner finding is evidence produced by an implemented rule. Rules can flag concrete risky patterns such as exposed credentials, insecure transport/configuration and authorization-sensitive API shapes where the scanner has a matching rule.</p>
      <p>Do not treat a clean scan as proof that an application is vulnerability-free, and do not describe the scanner as a replacement for a penetration test or formal audit.</p>
      <h2>OWASP mapping</h2>
      <p>Where a rule is mapped to OWASP/CWE language, the mapping helps classification and remediation. It is not a claim of complete coverage of every OWASP category.</p>
    `,
  },

  "kill-switch": {
    title: "Gateway kill switch",
    breadcrumb: "Products / Governance",
    lead: "Fail-closed controls for RaksHex-routed traffic, with durable PostgreSQL state and Redis propagation.",
    contentHtml: `
      <p>Workspace, identity, project and agent scoped kill-switch state can be evaluated before a RaksHex-routed provider request. The gateway reconciles low-latency Redis state with durable PostgreSQL state so a cache miss must not silently clear an active durable switch.</p>
      <h2>Budgets</h2>
      <p>Hard <code>gateway</code> budgets apply to traffic routed through the RaksHex gateway. <code>monitor_only</code> budgets are visibility/alerting and must not be described as blocks. <code>provider_native</code> enforcement is attempted only for provider capabilities that genuinely support it.</p>
      <h2>Critical boundary</h2>
      <p>A RaksHex gateway kill switch cannot truthfully be described as disabling direct provider traffic that bypasses RaksHex. Provider-side revocation/limits require a supported, authorised provider-native control.</p>
      <p>Runtime authorization of consequential agent actions is the separate <a href="/docs/agent-firewall">Agent Firewall</a> path.</p>
    `,
  },

  "cost-monitor": {
    title: "Usage & cost attribution",
    breadcrumb: "Products / Cost",
    lead: "Attribute usage that RaksHex observes or imports while preserving where the data came from and how certain it is.",
    contentHtml: `
      <p>RaksHex can aggregate workspace usage by member, provider, model and date from supported gateway/admin/import paths. Reporting supports bounded time windows and can associate usage with RaksHex identities where attribution data exists.</p>
      <h2>Source confidence matters</h2>
      <p>Usage/cost records can be provider-verified, imported, estimated or inferred depending on the connector and event source. The UI/API must preserve that distinction rather than labeling every number as exact provider billing.</p>
      <h2>Coverage boundary</h2>
      <p>RaksHex does not see “every request” made by a team unless those requests pass through an integrated observable path. Direct provider traffic with no supported admin/billing feed may be invisible.</p>
    `,
  },

  "thinking-tokens": {
    title: "Reasoning-token attribution",
    breadcrumb: "Products / Cost",
    lead: "Use provider-returned usage metadata when it exposes reasoning-token details; do not invent hidden-token precision when it does not.",
    contentHtml: `
      <p>Some model/provider responses expose additional usage detail for reasoning or cached-token categories. When that metadata is present, RaksHex can retain it as part of the observed usage record.</p>
      <p>If a provider does not return a reasoning-token breakdown, latency or model speed is not a truthful substitute for an exact hidden-token count. Any derived estimate must remain labeled as an estimate.</p>
    `,
  },

  "shadow-api": {
    title: "Shadow API discovery",
    breadcrumb: "Products / Security",
    lead: "Developer-workflow discovery for routes/endpoints the current analyzers can recognize, without claiming universal framework coverage.",
    contentHtml: `
      <p>The repository includes shadow-API discovery paths used by the developer tooling/control plane to compare discovered routes or API artifacts with known inventory.</p>
      <h2>Framework coverage</h2>
      <p>Support is determined by the analyzers present in the exact repository commit. This documentation intentionally does not claim universal FastAPI, Koa, Spring, Django, Flask or other framework extraction without a matching tested implementation.</p>
      <p>The CLI is not published as a public npm command during private beta, so use repository-local commands and the extension/dashboard flows that are actually available.</p>
    `,
  },

  credentials: {
    title: "Credential scanning & privacy controls",
    breadcrumb: "Products / Security",
    lead: "Detect supported secret patterns and keep telemetry/content handling aligned with explicit privacy modes.",
    contentHtml: `
      <p>RaksHex includes deterministic secret/credential scanning and redaction/scrubbing paths used by collection scanning, logging and telemetry controls.</p>
      <h2>No inflated detector count</h2>
      <p>This page does not publish a fixed “120+ signatures” number or claim specialised Aadhaar/PAN/passport checksum coverage unless the exact scanner implementation and tests demonstrate those patterns.</p>
      <h2>Telemetry privacy</h2>
      <p>AgentGuard supports privacy modes including metadata-first behavior. Provider credentials should remain in approved secret stores/mediation paths and must not be copied into browser-exposed variables or logs.</p>
    `,
  },

  compliance: {
    title: "Compliance evidence builder",
    breadcrumb: "Products / Compliance",
    lead: "Map implemented controls and evidence to framework language without claiming certification.",
    contentHtml: `
      <p>RaksHex stores security/governance evidence and can map supported records to compliance-control language for reporting/review.</p>
      <h2>What it can support</h2>
      <ul>
        <li>control/evidence mapping for supported framework catalogs,</li>
        <li>workspace-scoped audit and report evidence,</li>
        <li>exports provided by the current compliance/report implementation.</li>
      </ul>
      <h2>What it is not</h2>
      <p>Framework mapping is not SOC 2, ISO, PCI DSS, GDPR, EU AI Act or other certification/attestation. External assessment and legal/compliance ownership remain separate.</p>
    `,
  },

  mcp: {
    title: "MCP governance",
    breadcrumb: "Products / Security",
    lead: "Inventory and assess MCP/tool risk, then connect supported findings/governance to the RaksHex workspace model.",
    contentHtml: `
      <p><code>@rakshex/mcp-security</code> and the API-side MCP governance code provide the current MCP security surface.</p>
      <p>Do not infer a universal SQL proxy, human-approval layer, or blanket MCP tool blocker from the existence of this package. Whether an action can actually be blocked depends on whether that execution path is integrated with RaksHex enforcement.</p>
      <p>For consequential autonomous actions that are mediated through RaksHex, see the <a href="/docs/agent-firewall">Agent Firewall</a>.</p>
    `,
  },

  community: {
    title: "Community & support",
    breadcrumb: "Resources",
    lead: "Use the public repository for source/issues and the published RaksHex support contacts for private-beta questions.",
    contentHtml: `
      <ul>
        <li><strong>Repository:</strong> <a href="https://github.com/Akshu1245/Rakshex-complete-codebase" target="_blank" rel="noreferrer">Akshu1245/Rakshex-complete-codebase</a>.</li>
        <li><strong>Support:</strong> <a href="mailto:support@rakshex.in">support@rakshex.in</a> where that mailbox is operational.</li>
        <li><strong>Security:</strong> use the repository/security.txt process rather than posting suspected credentials publicly.</li>
      </ul>
      <p>Do not assume an unverified GitHub organisation, Discord, Slack community or other channel exists just because an old document mentioned one.</p>
    `,
  },

  sdk: {
    title: "SDK & examples",
    breadcrumb: "Documentation",
    lead: "Private-beta Node and Python clients for AgentGuard telemetry and Agent Firewall/action-control integration.",
    contentHtml: `
      <h2>Node source install</h2>
      <p>The repository package <code>@rakshex/sdk</code> includes AgentGuard telemetry/privacy support and an Agent Firewall client. During private beta, use the checked-out source unless/until a public registry release is explicitly verified.</p>
      <pre><code>git clone https://github.com/Akshu1245/Rakshex-complete-codebase.git
cd Rakshex-complete-codebase
pnpm install --frozen-lockfile
pnpm --filter @rakshex/sdk build</code></pre>

      <h2>Agent Firewall</h2>
      <pre><code>import { createAgentFirewallClient } from "@rakshex/sdk";

const firewall = createAgentFirewallClient({
  apiKey: process.env.RAKSHEX_API_KEY!,
  workspaceId: 1,
  agentId: "agent_123",
  capabilityToken: process.env.RAKSHEX_CAPABILITY_TOKEN!,
});</code></pre>
      <p>Use the brokered credential path when you need a DENY to prevent release/use of a centrally mediated provider credential. A callback run inside your own process still keeps that process responsible for the credential it already holds.</p>

      <h2>Python</h2>
      <p>The source package <code>rakshex-agentguard</code> includes both <code>AgentGuardClient</code> and <code>AgentFirewallClient</code>. It is not claimed as a public PyPI package yet.</p>
      <pre><code>python -m pip install -e "packages/agentguard-python[dev]"
python -m pytest packages/agentguard-python/tests</code></pre>
    `,
  },

  api: {
    title: "API reference overview",
    breadcrumb: "Documentation",
    lead: "Use current tRPC router types and explicitly mounted compatibility endpoints; do not copy invented REST routes from old docs.",
    contentHtml: `
      <p>Default local API origin: <code>http://localhost:3000</code>.</p>
      <h2>Health</h2>
      <pre><code>GET /api/health
GET /api/health/ready</code></pre>
      <h2>Application API</h2>
      <p>The main application API is tRPC. Current procedure names live in <code>apps/api/api/*.ts</code> and the application router types; use those types rather than a stale copied endpoint list.</p>
      <h2>Gateway compatibility</h2>
      <p>The repository includes OpenAI-compatible chat-completions and Anthropic Messages gateway routes. Those routes are subject to RaksHex workspace authentication/governance and are not a general unauthenticated proxy.</p>
      <h2>Telemetry</h2>
      <p>AgentGuard uses the implemented telemetry ingest path described by the SDK/API source. This page intentionally does not claim old <code>/v1/telemetry</code> or <code>/v1/findings</code> REST routes unless the current server actually mounts them.</p>
    `,
  },

  quickstart: {
    title: "Quickstart guides",
    breadcrumb: "Getting Started",
    lead: "Start with the Agent Firewall; use scanner/CLI/editor/MCP surfaces where their private-beta path fits your evaluation.",
    contentHtml: `
      <ul>
        <li><strong><a href="/docs/agent-firewall">Agent Firewall:</a></strong> authorise consequential actions before execution.</li>
        <li><strong><a href="/docs/quickstart/cli">CLI:</a></strong> repository-local scanning surface.</li>
        <li><strong><a href="/docs/quickstart/vscode">VS Code:</a></strong> packageable private-beta editor integration.</li>
        <li><strong><a href="/docs/quickstart/mcp">MCP:</a></strong> security inventory/governance work without an invented public package claim.</li>
      </ul>
    `,
  },

  frameworks: {
    title: "Framework integration status",
    breadcrumb: "Getting Started",
    lead: "RaksHex does not ship the old claimed drop-in FastAPI/Django/Flask/NestJS middleware packages shown in historical docs.",
    contentHtml: `
      <p>Integrate through the SDK/gateway/telemetry surfaces that actually exist in this repository. Framework-specific pages below are retained so old links do not break, but they now describe the current status rather than showing non-existent import paths.</p>
      <ul>
        <li><a href="/docs/frameworks/fastapi">FastAPI / Python</a></li>
        <li><a href="/docs/frameworks/express">Express / Node</a></li>
        <li><a href="/docs/frameworks/django">Django</a></li>
        <li><a href="/docs/frameworks/flask">Flask</a></li>
        <li><a href="/docs/frameworks/nestjs">NestJS</a></li>
      </ul>
    `,
  },

  "frameworks/fastapi": {
    title: "FastAPI / Python integration",
    breadcrumb: "Getting Started / Frameworks",
    lead: "Use the Python AgentGuard/Agent Firewall source client; no official RaksHex FastAPI middleware package is claimed today.",
    contentHtml: `
      <p>The private-beta Python package lives at <code>packages/agentguard-python</code>. It can be installed from the checked-out repository and used around the provider/action calls you want RaksHex to observe or govern.</p>
      <pre><code>python -m pip install -e "packages/agentguard-python[dev]"</code></pre>
      <p>Historical examples importing <code>rakshex.integrations.fastapi.RakshexMiddleware</code> were not supported by the current package and have been removed.</p>
    `,
  },

  "frameworks/express": {
    title: "Express / Node integration",
    breadcrumb: "Getting Started / Frameworks",
    lead: "Use @rakshex/sdk and the RaksHex gateway/action clients around the calls that need telemetry or enforcement.",
    contentHtml: `
      <p>The current Node SDK exports AgentGuard and Agent Firewall clients/provider wrappers; this documentation does not claim a generic <code>RaksHex.middleware()</code> Express API that is not present in the package.</p>
      <p>Build the repository package with <code>pnpm --filter @rakshex/sdk build</code> and follow the SDK/Agent Firewall examples.</p>
    `,
  },

  "frameworks/django": {
    title: "Django integration status",
    breadcrumb: "Getting Started / Frameworks",
    lead: "No dedicated RaksHex Django middleware package is claimed in the current private-beta source.",
    contentHtml: `
      <p>For Python applications, use the source <code>rakshex-agentguard</code> client around the LLM/action integrations you want to observe or govern. The historical <code>RaksHex.integrations.django</code> import path is not documented as available.</p>
    `,
  },

  "frameworks/flask": {
    title: "Flask integration status",
    breadcrumb: "Getting Started / Frameworks",
    lead: "No dedicated RaksHex Flask extension is claimed in the current private-beta source.",
    contentHtml: `
      <p>Use the Python AgentGuard/Agent Firewall clients from <code>packages/agentguard-python</code> at the provider/action boundary. The old <code>rakshex.integrations.flask</code> example was removed because it did not match the current package.</p>
    `,
  },

  "frameworks/nestjs": {
    title: "NestJS integration status",
    breadcrumb: "Getting Started / Frameworks",
    lead: "No separate @rakshex/nestjs package is claimed in the current repository.",
    contentHtml: `
      <p>Use the Node <code>@rakshex/sdk</code> clients inside your NestJS service where LLM calls or consequential agent actions occur. The historical <code>RakshexInterceptor</code> package example was not a current shipped package and has been removed.</p>
    `,
  },
};
