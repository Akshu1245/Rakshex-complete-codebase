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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Collections", href: "/collections", icon: FolderOpen },
  { label: "Scanning", href: "/scanning", icon: Search },
  { label: "Compliance", href: "/compliance", icon: Shield },
  { label: "Kill Switch", href: "/kill-switch", icon: Zap },
  { label: "Shadow APIs", href: "/shadow-apis", icon: Ghost },
  { label: "Team", href: "/team", icon: Users },
  { label: "Analytics", href: "/analytics", icon: TrendingUp },
  { label: "Token Analytics", href: "/token-analytics", icon: Coins },
  { label: "Audit Log", href: "/audit-log", icon: ClipboardList },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Import", href: "/import", icon: Upload },
  { label: "Admin", href: "/admin", icon: Wrench },
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

  const planBadgeColor = (plan?: string) => {
    switch (plan) {
      case "pro":
        return "bg-blue-900/30 text-blue-400 border border-blue-500/50";
      case "enterprise":
        return "bg-purple-900/30 text-purple-400 border border-purple-500/50";
      default:
        return "bg-gray-700 text-gray-300 border border-gray-600";
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gray-900 text-white w-64">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
        <Link href="/dashboard" className="text-2xl font-bold text-blue-400">
          DevPulse
        </Link>
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden text-gray-400 hover:text-white"
          aria-label="Close sidebar"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-blue-900/30 text-blue-400"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.name || "User"}
            </p>
            <span
              className={`inline-block text-xs px-2 py-0.5 rounded-full capitalize ${planBadgeColor(
                user?.plan
              )}`}
            >
              {user?.plan || "Free"}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />
          {/* Sidebar panel */}
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
