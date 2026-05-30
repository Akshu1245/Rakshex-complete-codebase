"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-transparent border-t border-[#1A1F2E] py-16 px-6 xl:px-8">
      <div className="max-w-[1280px] mx-auto">
        {/* 4-Column Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 text-left">
          <div className="flex flex-col gap-4">
            <a href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
              <img
                src="/icon-mark-128.png"
                alt="RaksHex"
                style={{
                  height: "40px",
                  width: "40px",
                  objectFit: "contain",
                  filter: "brightness(1.4) contrast(1.1)",
                }}
              />
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#d4a853",
                  letterSpacing: "0.5px",
                }}
              >
                RaksHex
              </span>
            </a>
            <p className="text-[#6B7280] text-xs leading-relaxed">
              India's first AI Runtime Governance platform. Securing the agentic future.
            </p>
            <div className="flex items-center gap-4 text-white">
              {/* Discord */}
              <a
                href="https://discord.gg/rakshex"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
                className="hover:text-[#14B8A6] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              </a>
              {/* GitHub */}
              <a
                href="https://github.com/rakshex-hq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="hover:text-[#14B8A6] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
              {/* Twitter */}
              <a
                href="https://twitter.com/rakshexhq"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="hover:text-[#14B8A6] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Products */}
          <div className="flex flex-col gap-3">
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-1 font-sans">
              Products
            </h4>
            <Link
              href="/features#security-scanner"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Security Scanner
            </Link>
            <Link
              href="/features#kill-switch"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Kill Switch
            </Link>
            <Link
              href="/features#cost-monitor"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Cost Monitor
            </Link>
            <Link
              href="/features#compliance"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Compliance
            </Link>
          </div>

          {/* Column 3: Resources */}
          <div className="flex flex-col gap-3">
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-1 font-sans">
              Resources
            </h4>
            <Link
              href="/blog"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Blog
            </Link>
            <Link
              href="/docs"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Documentation
            </Link>
            <Link
              href="/changelog"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Changelog
            </Link>
            <Link
              href="/roi-calculator"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              ROI Calculator
            </Link>
          </div>

          {/* Column 4: Legal & Company */}
          <div className="flex flex-col gap-3">
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-1 font-sans">
              Company
            </h4>
            <a
              href="mailto:akshay@rakshex.in"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Contact Support
            </a>
            <Link
              href="/privacy"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Terms & Conditions
            </Link>
            <Link
              href="/trust"
              className="text-[#9CA3AF] hover:text-[#14B8A6] text-sm transition-colors duration-150"
            >
              Trust Center
            </Link>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="border-t border-[#1A1F2E] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
              © 2026 RaksHex by Rashi Technologies, Bengaluru, India. All rights reserved.
            </p>
            <p style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
              Provisional Patents: NHCE/DEV/2026/001–004 · Contact: akshay@rakshex.in
            </p>
          </div>
          <Link
            href="/status"
            className="inline-flex items-center gap-2 text-[#6B7280] hover:text-white text-[12px] transition-colors duration-150 font-sans"
          >
            <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            All systems operational
          </Link>
        </div>
      </div>
    </footer>
  );
}
