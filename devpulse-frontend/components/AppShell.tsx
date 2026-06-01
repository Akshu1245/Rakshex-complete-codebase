"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { PublicHeader } from "@/components/PublicHeader";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useAuth } from "@/components/AuthProvider";

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

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && !isPublicPath(pathname)) {
      router.push("/login?redirect=" + encodeURIComponent(pathname));
    }
  }, [user, loading, pathname, router]);

  if (loading && !isPublicPath(pathname)) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#14B8A6]" />
          <p className="text-neutral-400 text-sm">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user && !isPublicPath(pathname)) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#14B8A6]" />
          <p className="text-neutral-400 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

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
    <AuthGuard>
      <div className="min-h-screen bg-transparent flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <DashboardHeader onMenuOpen={() => setSidebarOpen(true)} />
        <div className="flex-1 flex flex-col min-w-0 md:ml-64 mt-16">
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
