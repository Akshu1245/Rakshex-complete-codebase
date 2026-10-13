'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <div className="pl-[240px] transition-all duration-200">
        <Topbar />
        <main className="px-8 py-6 max-w-[1400px]">
          {children}
        </main>
      </div>
    </div>
  );
}
