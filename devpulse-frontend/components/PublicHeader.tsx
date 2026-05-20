"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_0_15px_rgba(207,188,255,0.08)] h-16 flex items-center">
      <div className="max-w-7xl mx-auto px-8 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-container rounded flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-on-primary-container"
                  style={{ fontVariationSettings: "'FILL' 1", fontSize: "16px" }}
                >
                  security
                </span>
              </div>
              <span
                className="text-primary font-bold"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "18px",
                  letterSpacing: "-0.02em",
                }}
              >
                DevPulse
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/demo"
                className="text-tertiary hover:text-tertiary/80 transition-colors"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
              >
                Live Demo
              </Link>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-on-surface-variant hover:text-on-surface transition-colors px-4 py-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                letterSpacing: "0.05em",
              }}
            >
              SIGN IN
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 bg-primary text-on-primary font-bold hover:shadow-[0_0_15px_rgba(207,188,255,0.4)] transition-all"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                letterSpacing: "0.05em",
              }}
            >
              GET STARTED
            </Link>
          </div>

          <button
            className="md:hidden text-on-surface-variant hover:text-on-surface p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">{mobileOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-surface-container-low border-b border-outline-variant/20 px-6 py-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-on-surface-variant hover:text-on-surface py-2 transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/demo"
            className="block text-tertiary py-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
            onClick={() => setMobileOpen(false)}
          >
            Live Demo
          </Link>
          <Link
            href="/login"
            className="block text-on-surface-variant py-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
            onClick={() => setMobileOpen(false)}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="block bg-primary text-on-primary text-center font-bold px-4 py-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
            onClick={() => setMobileOpen(false)}
          >
            GET STARTED
          </Link>
        </div>
      )}
    </header>
  );
}
