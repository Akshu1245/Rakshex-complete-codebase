"use client";

import { useSync } from "@/lib/offline/SyncProvider";

/**
 * Offline / sync status banner. Shows a red "offline" banner when the network
 * is down (with the count of changes queued for sync), and a transient teal
 * "syncing" pill when back online with pending changes still flushing.
 */
export function OfflineBanner() {
  const { online, pendingCount, syncNow } = useSync();

  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-2">
        <div className="mx-auto max-w-md border border-red-500/50 bg-red-950/90 rounded-lg p-3 shadow-lg flex items-start gap-3">
          <svg
            className="h-5 w-5 text-red-400 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12v.01M8.464 8.464a5 5 0 000 7.072M5.636 5.636a9 9 0 000 12.728"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-300">You&apos;re offline</p>
            <p className="text-xs text-red-200/70">
              Cached pages and data stay available.
              {pendingCount > 0
                ? ` ${pendingCount} change${pendingCount === 1 ? "" : "s"} queued — will sync when you reconnect.`
                : " Changes will sync when you reconnect."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Online but changes still pending → show a subtle sync pill.
  if (pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-2 pointer-events-none">
        <button
          type="button"
          onClick={() => void syncNow()}
          className="pointer-events-auto mx-auto flex items-center gap-2 border border-[#06D6A0]/50 bg-[#06D6A0]/10 text-[#06D6A0] rounded-full px-3 py-1 text-xs shadow-lg"
        >
          <span className="h-2 w-2 rounded-full bg-[#06D6A0] animate-pulse" />
          Syncing {pendingCount} change{pendingCount === 1 ? "" : "s"}…
        </button>
      </div>
    );
  }

  return null;
}
