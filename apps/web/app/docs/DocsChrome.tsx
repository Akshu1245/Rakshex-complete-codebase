"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TOC_BY_PATH: Record<string, { href: string; label: string }[]> = {
  "/docs": [
    { href: "#hello-world", label: "Hello world" },
    { href: "#running-vs-reading", label: "Reading vs running" },
    { href: "#optional-later", label: "Optional later" },
    { href: "#other-surfaces", label: "Other surfaces" },
  ],
  "/docs/agent-firewall": [
    { href: "#install", label: "Install" },
    { href: "#create-the-client", label: "Create the client" },
    { href: "#authorize-an-action", label: "Authorize an action" },
    { href: "#running-vs-reading", label: "Reading vs running" },
    { href: "#optional-later", label: "Optional later" },
  ],
};

function navClass(active: boolean, extra = "sidenav-item") {
  return active ? `${extra} active` : extra;
}

export function DocsChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const toc = TOC_BY_PATH[pathname] ?? [];
  const isSdk = pathname === "/docs/sdk";
  const isApi = pathname === "/docs/api";
  const isFirewall = pathname === "/docs/agent-firewall";
  const isOverview = pathname === "/docs";

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

        <Link href="/waitlist" className="docs-cta">
          Request access
        </Link>
      </header>

      <div className="docs-tabs">
        <Link href="/docs" className={isSdk || isApi ? "docs-tab" : "docs-tab active"}>
          Docs
        </Link>
        <Link href="/docs/sdk" className={isSdk ? "docs-tab active" : "docs-tab"}>
          SDK & Examples
        </Link>
        <Link href="/docs/api" className={isApi ? "docs-tab active" : "docs-tab"}>
          API Reference
        </Link>
      </div>

      <div className="docs-body">
        <aside className="docs-sidebar">
          <nav className="docs-sidenav">
            <Link href="/docs/community" className={navClass(pathname === "/docs/community")}>
              <span className="sidenav-icon">💬</span> Community
            </Link>
            <Link href="/blog" className="sidenav-item">
              <span className="sidenav-icon">📝</span> Blog
            </Link>
            <Link href="/changelog" className="sidenav-item">
              <span className="sidenav-icon">🗺️</span> Changelog
            </Link>
            <a
              href="https://github.com/Akshu1245/Rakshex-complete-codebase"
              className="sidenav-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="sidenav-icon">🐙</span> GitHub
            </a>

            <div className="sidenav-group-label">Getting Started</div>
            <Link href="/docs/agent-firewall" className={navClass(isFirewall)}>
              Agent Firewall
            </Link>
            <Link href="/docs" className={navClass(isOverview)}>
              Overview
            </Link>
            <div className="sidenav-group">
              <div className="sidenav-expandable">
                Optional later <span>›</span>
              </div>
              <div className="sidenav-children">
                <Link
                  href="/docs/quickstart/cli"
                  className={navClass(pathname === "/docs/quickstart/cli", "sidenav-child")}
                >
                  CLI scan
                </Link>
                <Link
                  href="/docs/quickstart/vscode"
                  className={navClass(pathname === "/docs/quickstart/vscode", "sidenav-child")}
                >
                  VS Code extension
                </Link>
                <Link
                  href="/docs/quickstart/mcp"
                  className={navClass(pathname === "/docs/quickstart/mcp", "sidenav-child")}
                >
                  MCP setup
                </Link>
              </div>
            </div>

            <div className="sidenav-group-label">Other surfaces</div>
            <Link
              href="/docs/security-scanner"
              className={navClass(pathname === "/docs/security-scanner")}
            >
              <span className="sidenav-icon">🔒</span> Security Scanner
            </Link>
            <Link href="/docs/kill-switch" className={navClass(pathname === "/docs/kill-switch")}>
              <span className="sidenav-icon">⚡</span> Kill Switch
            </Link>
            <Link
              href="/docs/cost-monitor"
              className={navClass(pathname === "/docs/cost-monitor")}
            >
              <span className="sidenav-icon">💰</span> Cost Monitor
            </Link>
            <Link
              href="/docs/thinking-tokens"
              className={navClass(pathname === "/docs/thinking-tokens")}
            >
              <span className="sidenav-icon">🧠</span> Thinking Tokens
            </Link>
            <Link href="/docs/shadow-api" className={navClass(pathname === "/docs/shadow-api")}>
              <span className="sidenav-icon">👻</span> Shadow API
            </Link>
            <Link href="/docs/credentials" className={navClass(pathname === "/docs/credentials")}>
              <span className="sidenav-icon">🔑</span> Credential Scanner
            </Link>
            <Link href="/docs/compliance" className={navClass(pathname === "/docs/compliance")}>
              <span className="sidenav-icon">📋</span> Compliance evidence
            </Link>
            <Link href="/docs/mcp" className={navClass(pathname === "/docs/mcp")}>
              <span className="sidenav-icon">🤖</span> MCP Governance
            </Link>
          </nav>
        </aside>

        <main className="docs-content">{children}</main>

        <aside className="docs-toc">
          {toc.length > 0 ? (
            <>
              <div className="toc-title">On this page</div>
              {toc.map((item, index) => (
                <a key={item.href} href={item.href} className={index === 0 ? "toc-link active" : "toc-link"}>
                  {item.label}
                </a>
              ))}
            </>
          ) : (
            <div className="toc-title">On this page</div>
          )}
        </aside>
      </div>
    </div>
  );
}
