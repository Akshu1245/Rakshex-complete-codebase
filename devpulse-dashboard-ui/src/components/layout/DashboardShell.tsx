'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardShell({ children }: { children: ReactNode }) {
  // Mobile nav is open only for the path it was opened on, so navigating closes it.
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const navOpen = openFor === pathname;
  const setNavOpen = (open: boolean) => setOpenFor(open ? pathname : null);

  return (
    <div className="min-h-screen bg-zinc-950 overflow-x-hidden">
      <Sidebar mobileOpen={navOpen} />
      {navOpen && (
        <button aria-label="Close navigation" onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden" />
      )}
      <div className="lg:pl-[240px] transition-all duration-200 min-w-0">
        <div className="lg:hidden flex items-center h-12 px-4 border-b border-zinc-800/50">
          <button aria-label="Open navigation" data-testid="nav-toggle" onClick={() => setNavOpen(true)}
            className="p-2 -ml-2 text-zinc-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <Topbar />
        <main className="px-4 py-4 lg:px-8 lg:py-6 max-w-[1400px] min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
