"use client";

import { useAuth } from "@/components/AuthProvider";
import { NotificationBell } from "@/components/NotificationBell";

interface DashboardHeaderProps {
  onMenuOpen: () => void;
}

export function DashboardHeader({ onMenuOpen }: DashboardHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 h-16 z-40 bg-surface/80 backdrop-blur-md border-b border-glass flex items-center justify-between px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuOpen}
        className="md:hidden text-on-surface-variant hover:text-on-surface mr-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open sidebar"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {/* Search */}
      <div className="flex items-center gap-4 bg-surface-container-low px-4 py-1.5 rounded-full border border-glass w-96 hidden md:flex">
        <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
        <input
          className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full font-body-md focus:outline-none"
          placeholder="Search vectors, nodes, or traffic trends..."
          type="text"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <NotificationBell />
          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">
            help_outline
          </span>
        </div>

        <div className="h-8 w-px bg-glass"></div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-primary leading-tight">Lead Security Engineer</p>
              <p className="text-[10px] text-on-surface-variant font-label-mono">
                ID: RX-{(user.name || user.email || "9921").slice(0, 4).toUpperCase()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full border border-primary/30 bg-primary-container/30 flex items-center justify-center text-primary font-bold text-sm">
              {(user.name || user.email || "U")[0].toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
