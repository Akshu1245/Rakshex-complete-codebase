import React from "react";
import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-root">
      {/* DOCS NAVBAR */}
      <header className="docs-navbar">
        <Link href="/" className="docs-logo">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00d4aa"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>RakshEx</span>
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
          <span>Search RakshEx docs...</span>
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
                <Link href="/docs/quickstart/mcp" className="sidenav-child">
                  MCP setup
                </Link>
              </div>
            </div>

            <div className="sidenav-group-label">Products</div>
            <div className="sidenav-expandable">
              Security Scanner <span>›</span>
            </div>
            <div className="sidenav-expandable">
              Kill Switch <span>›</span>
            </div>
            <div className="sidenav-expandable">
              Cost Monitor <span>›</span>
            </div>
            <div className="sidenav-expandable">
              Thinking Tokens <span>›</span>
            </div>
            <div className="sidenav-expandable">
              Shadow API <span>›</span>
            </div>
            <div className="sidenav-expandable">
              Credential Scanner <span>›</span>
            </div>
            <div className="sidenav-expandable">
              Compliance Reports <span>›</span>
            </div>
            <div className="sidenav-expandable">
              MCP Governance <span>›</span>
            </div>
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
