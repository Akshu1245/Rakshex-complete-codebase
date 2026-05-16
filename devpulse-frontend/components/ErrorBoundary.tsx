"use client";

import * as Sentry from "@sentry/react";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack ?? null,
        },
      },
      tags: {
        error_type: "react_error_boundary",
      },
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError =
        this.state.error?.message?.includes("Loading chunk") ||
        this.state.error?.message?.includes("Failed to fetch dynamically imported module");

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="w-full max-w-md border border-red-500/50 bg-red-950/20 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <svg
                className="h-6 w-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-red-400">
                {isChunkError ? "Update Required" : "Something went wrong"}
              </h2>
            </div>
            <p className="text-sm text-red-200/80">
              {isChunkError
                ? "A new version was deployed while you were using the app. Please refresh."
                : this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {isChunkError ? "Refresh Page" : "Try Again"}
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2 border border-red-500/30 text-red-300 rounded hover:bg-red-950/30 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Thin wrapper around Sentry.ErrorBoundary for lighter-weight error catching.
 */
export function SentryErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError, componentStack }) => {
        if (fallback) return <>{fallback}</>;
        return (
          <div className="p-6 bg-red-900/30 border border-red-500/50 rounded-lg">
            <h2 className="text-lg font-semibold text-red-400 mb-2">Something went wrong</h2>
            <p className="text-red-300 mb-4">
              {(error as Error).message || "An unexpected error occurred"}
            </p>
            <button
              onClick={resetError}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
