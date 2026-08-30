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
  { href: "/trust", label: "Trust" },
  { href: "/pricing", label: "Pricing" },
] as const;

const VSCODE_URL =
  "https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex-vscode";
const GITHUB_URL = "https://github.com/Akshu1245/Rakshex-complete-codebase";

export function PublicHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const showBanner = !HIDE_BANNER_PATHS.some((path) => pathname === path);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full max-w-full border-b border-white/10 bg-[#090D14]/95 backdrop-blur-xl">
      {showBanner && (
        <Link
          href="/waitlist"
          className="block border-b border-[#14B8A6]/20 bg-[#0B1414] no-underline hover:bg-[#0D1918]"
        >
          <div className="mx-auto flex min-h-[34px] w-full max-w-[1280px] items-center justify-center gap-2 px-3 py-1 text-center text-[10px] font-medium leading-4 text-neutral-300 sm:px-5 sm:text-xs">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#14B8A6]" aria-hidden="true" />
            <span className="sm:hidden">Private beta · Scoped Agent Firewall evaluation</span>
            <span className="hidden sm:inline">Private beta · Request a scoped Agent Firewall evaluation</span>
            <span className="hidden text-[#14B8A6] sm:inline">→</span>
          </div>
        </Link>
      )}

      <nav aria-label="Primary navigation">
        <div className="mx-auto flex h-[60px] w-full max-w-[1280px] items-center justify-between gap-2 px-3 sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-10">
            <Link href="/" className="shrink-0 no-underline" aria-label="RaksHex home">
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
                    className={`text-sm font-medium no-underline transition-colors ${
                      active ? "text-white" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
            <a
              href={VSCODE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-neutral-400 no-underline hover:text-white md:inline-flex"
              aria-label="RaksHex VS Code extension"
            >
              VS Code <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="RaksHex on GitHub"
              className="hidden rounded-md p-2 text-neutral-400 no-underline hover:text-white md:inline-flex"
            >
              <Github className="h-[18px] w-[18px]" aria-hidden="true" />
            </a>
            <Link
              href="/login"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-neutral-300 no-underline hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/waitlist"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-[#14B8A6] px-2.5 py-2 text-[11px] font-semibold text-white no-underline hover:bg-[#0D9488] sm:px-4 sm:text-sm"
            >
              <span className="sm:hidden">Join beta</span>
              <span className="hidden sm:inline">Request beta access</span>
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-public-navigation"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            id="mobile-public-navigation"
            className="max-h-[calc(100dvh-94px)] overflow-y-auto border-t border-white/10 bg-[#090D14] px-3 py-4 sm:px-5 sm:py-5 lg:hidden"
          >
            <div className="mx-auto flex max-w-[1280px] flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="rounded-md px-3 py-3 text-base font-medium text-neutral-200 no-underline hover:bg-white/[0.04] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/10 pt-4 min-[380px]:grid-cols-2">
                <a
                  href={VSCODE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 text-sm font-medium text-neutral-200 no-underline"
                >
                  VS Code <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-medium text-neutral-200 no-underline"
                >
                  <Github className="h-4 w-4" aria-hidden="true" /> GitHub
                </a>
              </div>
              <Link
                href="/login"
                onClick={closeMobileMenu}
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md border border-white/10 px-3 text-sm font-medium text-neutral-200 no-underline"
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
