"use client";

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 bg-white/5 rounded w-24" />
          <div className="h-4 bg-white/5 rounded flex-1" />
          <div className="h-4 bg-white/5 rounded w-16" />
          <div className="h-4 bg-white/5 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card rounded-xl p-5 border border-white/5 animate-pulse">
      <div className="h-4 bg-white/5 rounded w-32 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 bg-white/5 rounded" style={{ width: `${60 + i * 15}%` }} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "inventory_2",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#14b8a6]/10 border border-[#14b8a6]/20 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[#14b8a6] text-3xl">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-gray-500 text-sm max-w-md mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 bg-[#14b8a6] hover:bg-[#0d9488] text-white text-sm font-semibold rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-red-400 text-2xl">error_outline</span>
      </div>
      <p className="text-red-300 text-sm font-medium mb-1">Something went wrong</p>
      <p className="text-gray-500 text-xs max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 transition-all"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#14b8a6] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading enterprise data...</p>
      </div>
    </div>
  );
}
