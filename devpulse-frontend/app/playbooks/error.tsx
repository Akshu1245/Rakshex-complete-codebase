"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-white gap-4">
      <AlertTriangle className="w-12 h-12 text-red-400" />
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-gray-400 text-sm max-w-sm text-center">{error.message || "An unexpected error occurred."}</p>
      <button onClick={reset} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
        Try again
      </button>
    </div>
  );
}
