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
  { label: "Metrics", href: "/metrics", icon: "bar_chart", group: "ai" },
  { label: "Benchmark", href: "/benchmark", icon: "speed", group: "ai" },
  { label: "Team", href: "/team", icon: "group", group: "account" },
  { label: "Audit Log", href: "/audit-log", icon: "assignment", group: "account" },
  { label: "Settings", href: "/settings", icon: "settings", group: "account" },
  { label: "Billing", href: "/billing", icon: "credit_card", group: "account" },
  { label: "Admin", href: "/admin", icon: "build", group: "account" },
];

const GROUP_LABELS: Record<string, string> = {
  main: "Overview",
  security: "Security",
  ai: "AI Governance",
  account: "Account",
};

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

  const groups = ["main", "security", "ai", "account"];

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-40 flex flex-col transform transition-transform duration-300
          bg-surface-container-low/95 backdrop-blur-2xl border-r border-outline-variant/20
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-outline-variant/20">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-container rounded flex items-center justify-center">
              <span
                className="material-symbols-outlined text-on-primary-container"
                style={{ fontVariationSettings: "'FILL' 1", fontSize: "18px" }}
              >
                security
              </span>
            </div>
            <div>
              <h1
                className="font-display-lg text-headline-md text-primary leading-none"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: "18px",
                }}
              >
                DevPulse AI
              </h1>
              <p
                className="font-label-caps text-on-surface-variant mt-0.5"
                style={{ fontSize: "9px", letterSpacing: "0.2em" }}
              >
                System Alpha-9
              </p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-on-surface-variant hover:text-on-surface p-1 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              close
            </span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {groups.map((group) => {
            const groupItems = navItems.filter((i) => i.group === group);
            return (
              <div key={group} className="mb-3">
                <p
                  className="font-label-caps text-on-surface-variant/50 px-3 mb-1.5"
                  style={{ fontSize: "9px", letterSpacing: "0.15em" }}
                >
                  {GROUP_LABELS[group]}
                </p>
                {groupItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 text-body-md transition-all duration-200 mb-0.5 rounded
                        ${
                          active
                            ? "bg-primary-container/20 text-primary border-l-2 border-primary font-bold"
                            : "text-on-surface-variant hover:bg-surface-variant/30 hover:text-on-surface"
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
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom links */}
        <div className="border-t border-outline-variant/10 px-3 py-3 space-y-0.5">
          <Link
            href="/docs"
            className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              description
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
              Documentation
            </span>
          </Link>
          <Link
            href="/support"
            className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              support_agent
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}>
              Support
            </span>
          </Link>
        </div>

        {/* User footer */}
        <div className="border-t border-outline-variant/20 p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-container/30 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
                {(user.name || user.email || "U")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-on-surface font-bold truncate"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
                >
                  {user.name || user.email}
                </p>
                <p
                  className="text-on-surface-variant capitalize"
                  style={{ fontSize: "10px", letterSpacing: "0.1em" }}
                >
                  {user.plan || "free"} plan
                </p>
              </div>
              <button
                onClick={logout}
                className="text-on-surface-variant hover:text-error transition-colors p-1"
                title="Sign out"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  logout
                </span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-on-surface-variant hover:text-primary transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
            >
              Sign in →
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
