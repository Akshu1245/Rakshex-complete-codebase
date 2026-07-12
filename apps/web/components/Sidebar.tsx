"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  group?: string;
}

const navItems: NavItem[] = [
  { label: "Command Center", href: "/dashboard", icon: "dashboard", group: "main" },
  { label: "AI Control Plane", href: "/control-plane", icon: "hub", group: "main" },
  { label: "Collections", href: "/collections", icon: "folder_open", group: "main" },
  { label: "Import", href: "/import", icon: "upload", group: "main" },
  { label: "Scanning", href: "/scanning", icon: "search", group: "security" },
  { label: "Compliance", href: "/compliance", icon: "gavel", group: "security" },
  { label: "Kill Switch", href: "/kill-switch", icon: "power_settings_new", group: "security" },
  { label: "Shadow APIs", href: "/shadow-apis", icon: "visibility_off", group: "security" },
  { label: "Playbooks", href: "/playbooks", icon: "menu_book", group: "security" },
  { label: "Agent Drift", href: "/agent-drift", icon: "psychology", group: "ai" },
  { label: "Analytics", href: "/analytics", icon: "analytics", group: "ai" },
  { label: "Token Analytics", href: "/token-analytics", icon: "toll", group: "ai" },
  { label: "Copilot Metrics", href: "/dashboard/github-copilot", icon: "smart_toy", group: "ai" },
  { label: "Metrics", href: "/metrics", icon: "bar_chart", group: "ai" },
  { label: "Benchmark", href: "/benchmark", icon: "speed", group: "ai" },
  { label: "Team", href: "/team", icon: "group", group: "account" },
  { label: "Audit Log", href: "/audit-log", icon: "assignment", group: "account" },
  { label: "Settings", href: "/settings", icon: "settings", group: "account" },
  { label: "Billing", href: "/billing", icon: "credit_card", group: "account" },
  { label: "Admin", href: "/admin", icon: "build", group: "account" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transform transition-transform duration-300
          bg-surface-base border-r border-glass
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3 mb-10">
            <img src="/icon-mark-128.png" alt="RaksHex Mark" className="w-8 h-8 object-contain" />
            <div>
              <div className="font-headline-md text-headline-md font-bold tracking-tight text-primary leading-none">
                RaksHex
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-semibold mt-1">
                Elite API Security
              </div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              // Hide group headings, make it a single unified menu list like in the mockup
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded transition-all duration-200
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
            })}
          </nav>
        </div>

        {/* Bottom links */}
        <div className="mt-auto p-6 flex flex-col gap-1 border-t border-glass bg-surface-base/50">
          {user && (
            <button className="w-full py-3 mb-4 bg-primary text-on-primary font-bold rounded text-sm hover:brightness-110 active:scale-[0.98] transition-all">
              Upgrade Protection
            </button>
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

          {/* User footer */}
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
