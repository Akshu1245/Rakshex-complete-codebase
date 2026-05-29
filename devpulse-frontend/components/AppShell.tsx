"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { PublicHeader } from "@/components/PublicHeader";
import { DashboardHeader } from "@/components/DashboardHeader";

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
  "/docs",
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
    if (pathname.startsWith("/docs")) {
      return <>{children}</>;
    }
    return (
      <>
        <PublicHeader />
        {children}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <DashboardHeader onMenuOpen={() => setSidebarOpen(true)} />
      <div className="flex-1 flex flex-col min-w-0 md:ml-64 mt-16">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
