"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

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
            Some features may be unavailable. Changes will sync when you reconnect.
          </p>
        </div>
      </div>
    </div>
  );
}
