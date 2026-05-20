"use client";

import { useAuth } from "@/components/AuthProvider";

interface DashboardHeaderProps {
  onMenuOpen: () => void;
}

export function DashboardHeader({ onMenuOpen }: DashboardHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-64 right-0 h-16 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20 shadow-[0_0_15px_rgba(207,188,255,0.08)] flex items-center justify-between px-8">
      {/* Mobile menu button */}
      <button
        onClick={onMenuOpen}
        className="lg:hidden text-on-surface-variant hover:text-on-surface mr-3"
        aria-label="Open sidebar"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      {/* Search */}
      <div className="flex items-center gap-6 flex-1">
        <div className="relative group hidden md:block">
          <span className="absolute inset-y-0 left-3 flex items-center text-on-surface-variant">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              terminal
            </span>
          </span>
          <input
            className="bg-surface-container-highest/50 border border-outline-variant/30 rounded px-10 py-1.5 w-64 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all placeholder:text-on-surface-variant/50"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
            placeholder="QUERY SYSTEM AUDIT..."
            type="text"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant/30">
            notifications
          </button>
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant/30">
            terminal
          </button>
          <button className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant/30">
            settings
          </button>
        </div>

        {user && (
          <div className="flex items-center gap-3 border-l border-outline-variant/20 pl-6 cursor-pointer active:scale-95 transition-transform">
            <div className="text-right hidden sm:block">
              <p
                className="text-on-surface-variant"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                }}
              >
                SEC-OPS
              </p>
              <p
                className="text-primary font-bold"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}
              >
                {(user.name || user.email || "ALPHA_SEC").toUpperCase().slice(0, 12)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full border border-primary/30 bg-primary-container/30 flex items-center justify-center text-primary font-bold text-sm">
              {(user.name || user.email || "U")[0].toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
