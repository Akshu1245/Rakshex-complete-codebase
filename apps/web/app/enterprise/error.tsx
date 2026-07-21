"use client";

export default function EnterpriseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8">
      <h2 className="text-xl font-bold text-white mb-2">Enterprise dashboard error</h2>
      <p className="text-gray-400 mb-4 text-center max-w-md">
        {error?.message || "Failed to load enterprise views."}
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
