import React from "react";
import Link from "next/link";
import { DocsCodeBlock } from "../DocsCodeBlock";
import {
  FIREWALL_ADD_LOCAL,
  FIREWALL_AUTHORIZE_AND_RUN,
  FIREWALL_CLIENT,
  FIREWALL_EXECUTE_WITH_CREDENTIAL,
  FIREWALL_INSTALL,
} from "../firewallSnippets";

export const metadata = {
  title: "Agent Firewall — RaksHex Docs",
  description:
    "Get started with the RaksHex Agent Firewall: install @rakshex/sdk from this repository, create an Agent Firewall client, and authorize a semantic action. Reading does not require an account.",
  alternates: { canonical: "/docs/agent-firewall" },
};

export default function AgentFirewallDocsPage() {
  return (
    <article className="docs-article">
      <div className="docs-breadcrumb">Getting Started / Agent Firewall</div>

      <div className="docs-article-header">
        <div>
          <h1>Get started with the Agent Firewall</h1>
          <p className="docs-lead">
            Authorize one semantic action with <code>createAgentFirewallClient</code> before the
            agent runs it. This page is public. Running the client is not.
          </p>
        </div>
      </div>

      <p>
        RaksHex evaluates actions such as <code>financial.refund</code> against delegated authority,
        optionally brokers the credential so a DENY is enforced rather than advisory, and writes
        every decision to a hash-chained Action Ledger.
      </p>

      <h2 id="install">Install</h2>
      <p>
        The package name is <code>@rakshex/sdk</code>. It is <strong>not</strong> on the public npm
        registry during private beta — a plain <code>npm install @rakshex/sdk</code> will fail. Clone
        this repository, build the workspace package, then add it from disk:
      </p>
      <DocsCodeBlock caption="Clone and build @rakshex/sdk" code={FIREWALL_INSTALL} />
      <DocsCodeBlock caption="Depend on the built package from your app" code={FIREWALL_ADD_LOCAL} />
      <p className="docs-note">
        If you already have the monorepo checked out, skip the clone and run the build in place, then
        point your app at <code>packages/sdk</code>.
      </p>

      <h2 id="create-the-client">Create the client</h2>
      <p>
        Import <code>createAgentFirewallClient</code> from <code>@rakshex/sdk</code>. The workspace
        key is a RaksHex <code>rk_...</code> key, not a provider key. The capability token is a
        delegated <code>rk_cap_...</code> authority for this agent.
      </p>
      <DocsCodeBlock caption="createAgentFirewallClient" code={FIREWALL_CLIENT} />

      <h2 id="authorize-an-action">Authorize an action</h2>
      <p>
        Two ways to run work after a decision. Prefer credential brokering when the action can move
        money or change production data.
      </p>
      <p>
        <strong>Option A — <code>authorizeAndRun</code>:</strong> your process still holds the real
        provider key. RaksHex decides; your code is responsible for honoring a DENY.
      </p>
      <DocsCodeBlock caption="authorizeAndRun (caller holds the provider key)" code={FIREWALL_AUTHORIZE_AND_RUN} />
      <p>
        <strong>Option B — <code>executeWithCredential</code>:</strong> RaksHex holds the provider
        key and makes the call. A DENY is enforced by RaksHex, not by whether your code chose to
        honor it.
      </p>
      <DocsCodeBlock
        caption="executeWithCredential (RaksHex brokers the call)"
        code={FIREWALL_EXECUTE_WITH_CREDENTIAL}
      />
      <p>
        An API key scoped to <code>agent:execute</code> is enough for every call this client makes.
      </p>

      <h2 id="running-vs-reading">Reading vs running</h2>
      <p>
        You can read this guide with no account. To execute an action you need a private-beta
        workspace: a workspace API key (<code>rk_...</code>) and a capability token (
        <code>rk_cap_...</code>). There is no public self-serve checkout for keys.
      </p>
      <p>
        <Link href="/waitlist" className="docs-link">
          Request private-beta access →
        </Link>
      </p>

      <h2 id="optional-later">Optional later</h2>
      <p>
        After the Agent Firewall client is in place, you can add collection scanning or the editor
        extension. Neither is the first step.
      </p>
      <ul>
        <li>
          <Link href="/docs/quickstart/cli" className="docs-link">
            CLI collection scan
          </Link>{" "}
          — offline scan of Postman / OpenAPI files
        </li>
        <li>
          <Link href="/docs/quickstart/vscode" className="docs-link">
            VS Code extension
          </Link>{" "}
          — editor integration, not primary onboarding
        </li>
      </ul>

      <div className="mt-12 pt-6 border-t border-glass flex items-center justify-between">
        <Link href="/docs" className="docs-link">
          ← Back to overview
        </Link>
        <Link href="/waitlist" className="docs-cta">
          Request access
        </Link>
      </div>
    </article>
  );
}
