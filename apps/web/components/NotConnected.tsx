"use client";

interface NotConnectedStateProps {
  /** Human name of the missing data, e.g. "API keys". */
  resource: string;
  /** Optional one-line hint about where the data will come from. */
  detail?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Honest empty state for UI backed by a /api/* proxy route that answers 501
 * not_connected. Rendered instead of skeletons or zeros when the Workers
 * deployment has no backend for this resource yet. Never renders mock data.
 */
export function NotConnectedState({
  resource,
  detail,
  onRetry,
  className,
}: NotConnectedStateProps) {
  return (
    <div
      role="status"
      className={`rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center ${className ?? ""}`}
    >
      <p className="text-sm font-semibold text-gray-200">Not connected yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
        {resource} isn&apos;t available on this deployment — the backend API for it hasn&apos;t been
        connected, so there&apos;s nothing to show. No demo data is displayed.
      </p>
      {detail ? <p className="mx-auto mt-2 max-w-md text-xs text-gray-500">{detail}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-200 hover:bg-white/5"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
