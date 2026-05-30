import React from "react";
import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-root">
      <header className="docs-navbar">
        <Link href="/" className="docs-logo">
          <img src="/navbar-logo.png" alt="RaksHex" className="h-6 w-auto" />
        </Link>

        <div className="docs-search">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span>Search RaksHex docs...</span>
          <kbd>Ctrl K</kbd>
        </div>

        <Link href="/register" className="docs-cta">
          Get Started →
        </Link>
      </header>

      {/* DOCS TABS */}
      <div className="docs-tabs">
        <Link href="/docs" className="docs-tab active">
          Docs
        </Link>
        <Link href="/docs/sdk" className="docs-tab">
          SDK & Examples
        </Link>
        <Link href="/docs/api" className="docs-tab">
          API Reference
        </Link>
      </div>

      <div className="docs-body">
        {/* LEFT SIDEBAR */}
        <aside className="docs-sidebar">
          <nav className="docs-sidenav">
            <Link href="/docs/community" className="sidenav-item">
              <span className="sidenav-icon">💬</span> Community
            </Link>
            <Link href="/blog" className="sidenav-item">
              <span className="sidenav-icon">📝</span> Blog
            </Link>
            <Link href="/changelog" className="sidenav-item">
              <span className="sidenav-icon">🗺️</span> Changelog
            </Link>
            <a
              href="https://github.com/rakshex-hq"
              className="sidenav-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="sidenav-icon">🐙</span> GitHub
            </a>

            <div className="sidenav-group-label">Getting Started</div>
            <Link href="/docs" className="sidenav-item active">
              Overview
            </Link>
            <div className="sidenav-group">
              <div className="sidenav-expandable">
                Quickstart <span>›</span>
              </div>
              <div className="sidenav-children">
                <Link href="/docs/quickstart/cli" className="sidenav-child">
                  CLI setup · Recommended
                </Link>
                <Link href="/docs/quickstart/vscode" className="sidenav-child">
                  VS Code extension
                </Link>
                <Link href="/docs/quickstart/mcp" className="sidenav-child">
                  MCP setup
                </Link>
              </div>
            </div>

            <div className="sidenav-group-label">Products</div>
            <Link href="/docs/security-scanner" className="sidenav-item">
              <span className="sidenav-icon">🔒</span> Security Scanner
            </Link>
            <Link href="/docs/kill-switch" className="sidenav-item">
              <span className="sidenav-icon">⚡</span> Kill Switch
            </Link>
            <Link href="/docs/cost-monitor" className="sidenav-item">
              <span className="sidenav-icon">💰</span> Cost Monitor
            </Link>
            <Link href="/docs/thinking-tokens" className="sidenav-item">
              <span className="sidenav-icon">🧠</span> Thinking Tokens
            </Link>
            <Link href="/docs/shadow-api" className="sidenav-item">
              <span className="sidenav-icon">👻</span> Shadow API
            </Link>
            <Link href="/docs/credentials" className="sidenav-item">
              <span className="sidenav-icon">🔑</span> Credential Scanner
            </Link>
            <Link href="/docs/compliance" className="sidenav-item">
              <span className="sidenav-icon">📋</span> Compliance Reports
            </Link>
            <Link href="/docs/mcp" className="sidenav-item">
              <span className="sidenav-icon">🤖</span> MCP Governance
            </Link>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="docs-content">{children}</main>

        {/* RIGHT TOC */}
        <aside className="docs-toc">
          <div className="toc-title">On this page</div>
          <a href="#connect-first" className="toc-link active">
            Connect first
          </a>
          <a href="#pick-a-framework" className="toc-link">
            Pick a framework
          </a>
          <a href="#core-products" className="toc-link">
            Core products
          </a>
        </aside>
      </div>
    </div>
  );
}
