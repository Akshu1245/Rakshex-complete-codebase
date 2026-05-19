"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderOpen,
  Search,
  Shield,
  Zap,
  Ghost,
  Users,
  TrendingUp,
  Coins,
  ClipboardList,
  Settings,
  CreditCard,
  Upload,
  Wrench,
  Brain,
  Gauge,
  BookOpen,
  BarChart3,
  X,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
}

const navItems: NavItem[] = [
  // Main
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "main" },
  { label: "Collections", href: "/collections", icon: FolderOpen, group: "main" },
  { label: "Import", href: "/import", icon: Upload, group: "main" },

  // Security
  { label: "Scanning", href: "/scanning", icon: Search, group: "security" },
  { label: "Compliance", href: "/compliance", icon: Shield, group: "security" },
  { label: "Kill Switch", href: "/kill-switch", icon: Zap, group: "security" },
  { label: "Shadow APIs", href: "/shadow-apis", icon: Ghost, group: "security" },
  { label: "Playbooks", href: "/playbooks", icon: BookOpen, group: "security" },

  // AI Governance
  { label: "Agent Drift", href: "/agent-drift", icon: Brain, group: "ai" },
  { label: "Analytics", href: "/analytics", icon: TrendingUp, group: "ai" },
  { label: "Token Analytics", href: "/token-analytics", icon: Coins, group: "ai" },
  { label: "Metrics", href: "/metrics", icon: BarChart3, group: "ai" },
  { label: "Benchmark", href: "/benchmark", icon: Gauge, group: "ai" },

  // Account
  { label: "Team", href: "/team", icon: Users, group: "account" },
  { label: "Audit Log", href: "/audit-log", icon: ClipboardList, group: "account" },
  { label: "Settings", href: "/settings", icon: Settings, group: "account" },
  { label: "Billing", href: "/billing", icon: CreditCard, group: "account" },
  { label: "Admin", href: "/admin", icon: Wrench, group: "account" },
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
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-40 flex flex-col transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">DevPulse</span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {groups.map(group => {
            const groupItems = navItems.filter(i => i.group === group);
            return (
              <div key={group} className="mb-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest px-3 mb-1.5">
                  {GROUP_LABELS[group]}
                </p>
                {groupItems.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5
                        ${active
                          ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20"
                          : "text-gray-400 hover:text-white hover:bg-gray-800"
                        }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? "text-indigo-400" : ""}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-800 p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
                {(user.name || user.email || "U")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name || user.email}</p>
                <p className="text-xs text-gray-500 capitalize">{user.plan || "free"} plan</p>
              </div>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-red-400 transition-colors p-1"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Sign in →
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
