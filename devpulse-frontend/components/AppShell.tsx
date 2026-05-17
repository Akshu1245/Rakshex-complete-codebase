"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { PublicHeader } from "@/components/PublicHeader";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/privacy",
  "/terms",
  "/cookies",
  "/pricing",
  "/demo",
  "/blog",
  "/blog/helicone-alternative",
  "/blog/portkey-alternative",
  "/blog/lakera-alternative",
  "/compare",
  "/compare/helicone",
  "/compare/portkey",
  "/compare/lakera",
  "/compare/langsmith",
  "/compare/datadog",
  "/compare/snyk",
  "/roi-calculator",
  "/features",
  "/about",
  "/faq",
  "/trust",
  "/changelog",
  "/integrations",
  "/partners",
  "/open-source",
  "/status",
  "/solutions/fintech",
  "/solutions/healthcare",
  "/solutions/enterprise",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => p === pathname || (p !== "/" && pathname.startsWith(p)));
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isPublicPath(pathname)) {
    return (
      <>
        <PublicHeader />
        {children}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="text-lg font-bold text-blue-400">DevPulse</span>
        </div>

        {/* Main content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
