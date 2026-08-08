"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  group?: string;
  adminOnly?: boolean;
}

const primaryItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "dashboard" },
  { label: "APIs & collections", href: "/collections", icon: "folder_open" },
  { label: "Findings", href: "/findings", icon: "bug_report" },
  { label: "Scans", href: "/scanning", icon: "search" },
  { label: "AI control plane", href: "/control-plane", icon: "hub" },
  { label: "Compliance", href: "/compliance", icon: "gavel" },
  { label: "Team", href: "/team", icon: "group" },
  { label: "Workspace & billing", href: "/workspace", icon: "domain" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

const advancedItems: NavItem[] = [
  { label: "Import directly", href: "/import", icon: "upload" },
  { label: "Kill Switch", href: "/kill-switch", icon: "power_settings_new", group: "security" },
  { label: "Shadow APIs", href: "/shadow-apis", icon: "visibility_off", group: "security" },
  { label: "Red Team", href: "/red-team", icon: "swords", group: "security" },
  { label: "Cost Anomalies", href: "/agent-drift", icon: "psychology", group: "ai" },
  { label: "Reports", href: "/report", icon: "description", group: "security" },
  { label: "Analytics", href: "/analytics", icon: "analytics", group: "ai" },
  { label: "Token Analytics", href: "/token-analytics", icon: "toll", group: "ai" },
  { label: "Copilot Metrics", href: "/dashboard/github-copilot", icon: "smart_toy", group: "ai" },
  { label: "Notifications", href: "/notifications", icon: "notifications", group: "account" },
  { label: "Audit Log", href: "/audit-log", icon: "assignment", group: "account" },
  { label: "Admin", href: "/admin", icon: "build", group: "account", adminOnly: true },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const visibleAdvancedItems = advancedItems.filter((item) => !item.adminOnly || isAdmin);
  const advancedIsActive = visibleAdvancedItems.some((item) => isActive(item.href));

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={`flex items-center gap-3 px-4 py-2.5 rounded transition-all duration-200
          ${
            active
              ? "text-primary bg-primary/10 border-r-2 border-primary font-semibold"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
          }`}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: "20px",
            fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          {item.icon}
        </span>
        <span className="font-button-text text-button-text">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transform transition-transform duration-300
          bg-surface-base border-r border-glass
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="p-6 overflow-y-auto flex-1">
          <Link href="/dashboard" className="flex items-center gap-3 mb-10 group">
            <img
              src="/icon-mark-128.png"
              alt="RaksHex Mark"
              className="w-9 h-9 rounded-lg border border-[#14B8A6]/30 shadow-[0_0_12px_rgba(20,184,166,0.25)] object-cover transition-all duration-300 group-hover:border-[#14B8A6]/60 group-hover:shadow-[0_0_20px_rgba(20,184,166,0.4)]"
            />
            <div>
              <div className="font-headline-md text-headline-md font-bold tracking-tight text-white leading-none">
                Raks<span className="text-[#14B8A6]">Hex</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#14B8A6] font-semibold mt-1">
                AI &amp; API security
              </div>
            </div>
          </Link>

          <nav className="flex flex-col gap-1">
            {primaryItems.map(renderItem)}
            <details className="mt-2" open={advancedIsActive}>
              <summary className="cursor-pointer list-none px-4 py-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant hover:text-on-surface">
                More tools
              </summary>
              <div className="mt-1 flex flex-col gap-1 border-l border-glass pl-1">
                {visibleAdvancedItems.map(renderItem)}
              </div>
            </details>
          </nav>
        </div>

        <div className="p-6 flex flex-col gap-1 border-t border-glass bg-surface-base/50">
          {user && (
            <Link
              href="/workspace"
              onClick={onClose}
              className="w-full py-3 mb-4 bg-primary text-on-primary font-bold rounded text-sm hover:brightness-110 active:scale-[0.98] transition-all text-center block"
            >
              Manage plan
            </Link>
          )}

          <Link
            href="/docs"
            className="flex items-center gap-3 px-4 py-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">description</span>
            <span className="font-button-text text-button-text">Documentation</span>
          </Link>
          <Link
            href="/contact"
            className="flex items-center gap-3 px-4 py-2 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">help</span>
            <span className="font-button-text text-button-text">Support</span>
          </Link>

          <div className="border-t border-glass pt-4 mt-2">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate font-body-md leading-tight">
                    {user.name || user.email}
                  </p>
                  <p className="text-[10px] text-on-surface-variant uppercase font-label-mono mt-0.5">
                    {user.plan || "free"} plan
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="text-on-surface-variant hover:text-status-error transition-colors p-1"
                  title="Sign out"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    logout
                  </span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-on-surface-variant hover:text-primary transition-colors text-xs font-bold font-body-md block"
              >
                Sign in →
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
