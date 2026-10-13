'use client';

import { useEffect, useState } from 'react';
import { isBackendOnline } from '@/lib/api';

/**
 * Shows a persistent warning banner when the backend API is unreachable.
 * Automatically hides when connectivity is restored.
 */
export default function BackendStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffline(!isBackendOnline());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white"
      style={{ background: 'linear-gradient(90deg, #dc2626, #ef4444)' }}
    >
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>
        Backend API is offline — data shown may be stale. Check that the server is running.
      </span>
    </div>
  );
}
