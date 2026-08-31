"use client";

import { useAuth } from "@/components/AuthProvider";
import { NotificationBell } from "@/components/NotificationBell";

interface DashboardHeaderProps {
  onMenuOpen: () => void;
}

export function DashboardHeader({ onMenuOpen }: DashboardHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 h-16 z-40 bg-surface/80 backdrop-blur-md border-b border-glass flex items-center justify-between px-3 sm:px-4 md:px-6">
      <button
        onClick={onMenuOpen}
        className="md:hidden text-on-surface-variant hover:text-on-surface mr-2 sm:mr-3 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
        aria-label="Open sidebar"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      <div className="flex items-center gap-4 bg-surface-container-low px-4 py-1.5 rounded-full border border-glass w-96 hidden md:flex min-w-0">
        <span className="material-symbols-outlined text-on-surface-variant text-sm shrink-0">search</span>
        <input
          className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full min-w-0 font-body-md focus:outline-none"
          placeholder="Search vectors, nodes, or traffic trends..."
          type="text"
        />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4 md:gap-6">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <NotificationBell />
          <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors hidden sm:inline-block">
            help_outline
          </span>
        </div>

        <div className="h-8 w-px bg-glass hidden sm:block"></div>

        {user && (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="text-right hidden lg:block min-w-0">
              <p className="text-xs font-bold text-primary leading-tight truncate">Lead Security Engineer</p>
              <p className="text-[10px] text-on-surface-variant font-label-mono truncate">
                ID: RX-{(user.name || user.email || "9921").slice(0, 4).toUpperCase()}
              </p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-primary/30 bg-primary-container/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {(user.name || user.email || "U")[0].toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
