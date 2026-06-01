export default function AnalyticsLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 w-40 bg-black/50 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-56 bg-black/50 rounded animate-pulse"></div>
          </div>
          <div className="h-4 w-32 bg-black/50 rounded animate-pulse"></div>
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-black/50 p-6 rounded-lg border border-gray-700">
              <div className="h-4 w-24 bg-gray-700 rounded animate-pulse mb-4"></div>
              <div className="h-10 w-28 bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Two-column layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <div className="h-6 w-48 bg-gray-700 rounded animate-pulse mb-4"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-gray-700 rounded animate-pulse mb-2"></div>
            ))}
          </div>
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <div className="h-6 w-32 bg-gray-700 rounded animate-pulse mb-4"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 w-full bg-gray-700 rounded animate-pulse mb-2"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
