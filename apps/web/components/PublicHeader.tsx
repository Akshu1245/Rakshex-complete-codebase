"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Github, Menu, ShieldCheck, X } from "lucide-react";
import { RaksHexLogo } from "@/components/common/RaksHexLogo";

const HIDE_BANNER_PATHS = [
  "/login",
  "/register",
  "/reset-password",
  "/privacy",
  "/terms",
  "/cookies",
];
const NAV_ITEMS = [
  { href: "/overview", label: "Product" },
  { href: "/demo", label: "Demo" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
  { href: "/trust", label: "Trust" },
] as const;
const VSCODE_URL =
  "https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode";
const GITHUB_URL = "https://github.com/Akshu1245/Rakshex-complete-codebase";

export function PublicHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showBanner = !HIDE_BANNER_PATHS.some((path) => pathname === path);

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-white/10 bg-[#090D14]/95 backdrop-blur-xl">
      {showBanner && (
        <Link
          href="/waitlist"
          className="block border-b border-[#14B8A6]/20 bg-[#0B1414] no-underline hover:bg-[#0D1918]"
        >
          <div className="mx-auto flex h-[34px] max-w-[1280px] items-center justify-center gap-2 px-5 text-center text-[11px] font-medium text-neutral-300 sm:text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#14B8A6]" />
            <span>Private beta · Verified waitlist for AI agent builders and teams</span>
            <span className="hidden text-[#14B8A6] sm:inline">→</span>
          </div>
        </Link>
      )}
      <nav aria-label="Primary navigation">
        <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between px-5 sm:px-6 xl:px-8">
          <div className="flex items-center gap-10">
            <Link href="/" aria-label="RaksHex home">
              <RaksHexLogo size={30} />
            </Link>
            <div className="hidden items-center gap-7 lg:flex">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm font-medium no-underline ${
                      active ? "text-white" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={VSCODE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 px-2 py-2 text-xs font-medium text-neutral-400 no-underline hover:text-white md:inline-flex"
            >
              VS Code <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="RaksHex on GitHub"
              className="hidden p-2 text-neutral-400 hover:text-white md:inline-flex"
            >
              <Github className="h-[18px] w-[18px]" />
            </a>
            <Link
              href="/login"
              className="hidden px-3 py-2 text-sm font-medium text-neutral-300 no-underline hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/waitlist"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#14B8A6] px-3.5 py-2 text-xs font-semibold text-white no-underline hover:bg-[#0D9488] sm:px-4 sm:text-sm"
            >
              Request beta access
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white lg:hidden"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#090D14] px-5 py-5 lg:hidden">
            <div className="mx-auto flex max-w-[1280px] flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-neutral-200 no-underline hover:bg-white/[0.04]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-3 text-sm text-neutral-200"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
