"use client";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Billing Error</h2>
        <p className="text-gray-400 mb-4">Failed to load billing information. Please try again.</p>
        {error?.message && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-6 font-mono">
            {error.message}
          </p>
        )}
        <button
          onClick={reset}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
