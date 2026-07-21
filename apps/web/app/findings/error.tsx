"use client";

export default function FindingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8">
      <h2 className="text-xl font-bold text-white mb-2">Findings failed to load</h2>
      <p className="text-gray-400 mb-4 text-center max-w-md">
        {error?.message || "Something went wrong loading findings."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
