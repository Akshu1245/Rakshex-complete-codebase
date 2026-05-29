import React from "react";
import Link from "next/link";

export default function DocsOverview() {
  return (
    <article className="docs-article">
      <div className="docs-breadcrumb">Getting Started</div>

      <div className="docs-article-header">
        <div>
          <h1>Overview</h1>
          <p className="docs-lead">
            The AI-native security and governance platform for production AI agents.
          </p>
        </div>
        <button className="docs-copy-btn">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy page
        </button>
      </div>

      <p>
        RakshEx gives your AI agents and APIs real-time security scanning, LLM cost attribution,
        prompt injection blocking, and compliance reporting — all in one platform. 478 server tests.
        4 patents filed.
      </p>

      <h2 id="connect-first">Connect first</h2>
      <p>
        Required setup. Pick one path to link your environment to RakshEx before you start building.
        Start with the CLI for a universal terminal-based setup; add the VS Code extension if you
        prefer in-editor visibility.
      </p>

      <div className="docs-card-grid cols-2">
        <Link href="/docs/quickstart/cli" className="docs-card">
          <div className="docs-card-icon">›_</div>
          <div className="docs-card-title">Connect via CLI</div>
          <p>npx rakshex scan ./collection.json — works in any terminal.</p>
        </Link>
        <Link href="/docs/quickstart/vscode" className="docs-card">
          <div className="docs-card-icon">⚡</div>
          <div className="docs-card-title">Connect via VS Code</div>
          <p>Install the RakshEx extension for inline scanning and cost alerts.</p>
        </Link>
      </div>

      <h2 id="pick-a-framework">Pick a framework</h2>

      <div className="docs-card-grid cols-5">
        {["FastAPI", "Express", "Django", "Flask", "NestJS"].map((fw) => (
          <Link
            key={fw}
            href={`/docs/frameworks/${fw.toLowerCase()}`}
            className="docs-card docs-card-sm"
          >
            <div className="docs-card-title">{fw}</div>
          </Link>
        ))}
      </div>
      <Link href="/docs/quickstart" className="docs-link">
        All quickstart guides →
      </Link>

      <h2 id="core-products">Core products</h2>

      <div className="docs-card-grid cols-2">
        {[
          {
            title: "Security Scanner",
            icon: "🔒",
            desc: "87-payload injection library. OWASP Top 10.",
            href: "/docs/security-scanner",
          },
          {
            title: "Kill Switch",
            icon: "⚡",
            desc: "Autonomous circuit breaker. Sub-second.",
            href: "/docs/kill-switch",
          },
          {
            title: "Cost Monitor",
            icon: "💰",
            desc: "Holt-Winters forecasting. Per-model breakdown.",
            href: "/docs/cost-monitor",
          },
          {
            title: "Thinking Tokens",
            icon: "🧠",
            desc: "World-first reasoning token isolation.",
            href: "/docs/thinking-tokens",
          },
          {
            title: "Shadow API",
            icon: "👻",
            desc: "Static route extraction for all major frameworks.",
            href: "/docs/shadow-api",
          },
          {
            title: "Credential Scanner",
            icon: "🔑",
            desc: "AWS, GitHub, Aadhaar, PAN detection.",
            href: "/docs/credentials",
          },
          {
            title: "Compliance Reports",
            icon: "📋",
            desc: "SOC2, PCI DSS, OWASP. One-click PDF.",
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
