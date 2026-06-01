export default function Loading() {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-7xl space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="h-4 w-48 bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-gray-700 rounded-full animate-pulse"></div>
            <div className="h-4 w-20 bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-black/50 p-6 rounded-lg border border-gray-700">
              <div className="h-3 w-24 bg-gray-700 rounded animate-pulse mb-3"></div>
              <div className="h-8 w-20 bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-2 w-32 bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
          <div className="h-5 w-32 bg-gray-700 rounded animate-pulse mb-4"></div>
          <div className="h-48 bg-gray-700 rounded animate-pulse"></div>
        </div>

        {/* Activity list skeleton */}
        <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
          <div className="h-5 w-40 bg-gray-700 rounded animate-pulse mb-4"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex justify-between items-center bg-gray-700/30 p-3 rounded mb-2"
            >
              <div className="h-4 w-32 bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 w-20 bg-gray-700 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
