'use client';

import { Badge } from '@/components/ui/Shared';

export default function Topbar() {
  return (
    <header className="h-16 border-b border-zinc-800/40 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-8">
      <div className="flex items-center gap-3">
        <Badge variant="success" dot>All systems operational</Badge>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/60 border border-zinc-800/60 rounded-lg text-[11px] text-zinc-500 font-medium">
          <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" /></svg>
          AES-256 Encrypted
        </span>

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800/60 rounded-lg hover:border-zinc-700 transition-colors"
        >
          API Docs
        </a>

        <a
          href="https://github.com/ganesh2317/DevPulse"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-colors"
        >
          <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
          </svg>
        </a>
      </div>
    </header>
  );
}
