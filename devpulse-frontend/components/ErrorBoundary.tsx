"use client";

import * as Sentry from "@sentry/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SentryErrorBoundary({ children, fallback }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="p-6 bg-red-900/30 border border-red-500/50 rounded-lg">
          <h2 className="text-lg font-semibold text-red-400 mb-2">
            Something went wrong
          </h2>
          <p className="text-red-300 mb-4">
            {error.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={resetError}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
