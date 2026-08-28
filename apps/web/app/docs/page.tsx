import React from "react";
import Link from "next/link";
import { DocsCodeBlock } from "./DocsCodeBlock";
import {
  FIREWALL_ADD_LOCAL,
  FIREWALL_ADD_WORKSPACE,
  FIREWALL_AUTHORIZE_AND_RUN,
  FIREWALL_CLIENT,
  FIREWALL_INSTALL,
} from "./firewallSnippets";

export const metadata = {
  title: "Docs — RaksHex Agent Firewall",
  description:
    "Public getting started for the RaksHex Agent Firewall. Create a Node client with createAgentFirewallClient. Reading does not require an account.",
  alternates: { canonical: "/docs" },
};

export default function DocsOverview() {
  return (
    <article className="docs-article">
      <div className="docs-breadcrumb">Getting Started</div>

      <div className="docs-article-header">
        <div>
          <h1>Agent Firewall</h1>
          <p className="docs-lead">
            Runtime authorization for autonomous AI actions. Competitors govern the session. RaksHex
            governs the action.
          </p>
        </div>
      </div>

      <p>
        These docs are public. You do not need an account to read them. The first step is the Node
        client <code>createAgentFirewallClient</code> from this repo&apos;s{" "}
        <code>packages/sdk</code> — not the CLI scanner, and not the VS Code extension.
      </p>

      <h2 id="hello-world">Hello world</h2>
      <p>
        This week&apos;s hello-world is the Node client in this repo at <code>packages/sdk</code>.
        Build that package, then add it by workspace path. The first step is{" "}
        <code>createAgentFirewallClient</code> — not the CLI scanner, and not the VS Code extension.
      </p>

      <DocsCodeBlock caption="Build packages/sdk from this repository" code={FIREWALL_INSTALL} />
      <DocsCodeBlock caption="Workspace path install (inside this repo)" code={FIREWALL_ADD_WORKSPACE} />
      <DocsCodeBlock caption="Path install from another project" code={FIREWALL_ADD_LOCAL} />
      <DocsCodeBlock caption="Create the Agent Firewall client" code={FIREWALL_CLIENT} />
      <DocsCodeBlock caption="Authorize a semantic action" code={FIREWALL_AUTHORIZE_AND_RUN} />

      <p>
        <Link href="/docs/agent-firewall" className="docs-link">
          Full Agent Firewall getting started →
        </Link>
      </p>

      <h2 id="running-vs-reading">Reading vs running</h2>
      <p>
        Reading this page does not require a login. Running the client against the live API does: you
        need a private-beta invite, a workspace API key (<code>rk_...</code>), and a capability token
        (<code>rk_cap_...</code>). Request access on the waitlist if you do not have keys yet.
      </p>
      <p>
        <Link href="/waitlist" className="docs-link">
          Request private-beta access →
        </Link>
      </p>

      <h2 id="optional-later">Optional later</h2>
      <p>
        Collection scanning and the editor extension are later surfaces. They are not the hello-world
        path.
      </p>
      <div className="docs-card-grid cols-2">
        <Link href="/docs/quickstart/cli" className="docs-card">
          <div className="docs-card-icon">›_</div>
          <div className="docs-card-title">CLI scan</div>
          <p>Offline collection scanning. Optional after the Agent Firewall client.</p>
        </Link>
        <Link href="/docs/quickstart/vscode" className="docs-card">
          <div className="docs-card-icon">⚡</div>
          <div className="docs-card-title">VS Code extension</div>
          <p>Editor integration. Not the first onboarding step.</p>
        </Link>
      </div>

      <h2 id="other-surfaces">Other surfaces</h2>
      <p>
        Scanner, cost, and evidence export exist in the product. They are not the core path. The
        Agent Firewall is.
      </p>
      <div className="docs-card-grid cols-2">
        {[
          {
            title: "Security Scanner",
            icon: "🔒",
            desc: "Prompt-injection and API collection scanning.",
            href: "/docs/security-scanner",
          },
          {
            title: "Kill Switch",
            icon: "⚡",
            desc: "Circuit breaker for budget and policy trips.",
            href: "/docs/kill-switch",
          },
          {
            title: "Cost Monitor",
            icon: "💰",
            desc: "Token and model cost visibility.",
            href: "/docs/cost-monitor",
          },
          {
            title: "Thinking Tokens",
            icon: "🧠",
            desc: "Reasoning-token cost visibility.",
            href: "/docs/thinking-tokens",
          },
          {
            title: "Shadow API",
            icon: "👻",
            desc: "Static route extraction for common frameworks.",
            href: "/docs/shadow-api",
          },
          {
            title: "Credential Scanner",
            icon: "🔑",
            desc: "Detects leaked cloud keys and secrets in collections.",
            href: "/docs/credentials",
          },
          {
            title: "Compliance evidence",
            icon: "📋",
            desc: "Map controls to PCI DSS, SOC 2, and OWASP. Evidence, not a certification.",
            href: "/docs/compliance",
          },
          {
            title: "MCP Governance",
            icon: "🤖",
            desc: "Tool registry, risk scoring, allowlists.",
            href: "/docs/mcp",
          },
        ].map((card) => (
          <Link key={card.title} href={card.href} className="docs-card">
            <div className="docs-card-icon">{card.icon}</div>
            <div className="docs-card-title">{card.title}</div>
            <p>{card.desc}</p>
          </Link>
        ))}
      </div>

      <p>
        Track new features and fixes in the{" "}
        <Link href="/changelog" className="docs-link">
          changelog
        </Link>
        .
      </p>
    </article>
  );
}
