export default function ScanningLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="h-8 w-48 bg-black/50 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-56 bg-black/50 rounded animate-pulse"></div>
          </div>
          <div className="h-4 w-32 bg-black/50 rounded animate-pulse"></div>
        </div>

        {/* Two-column layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <div className="h-6 w-32 bg-gray-700 rounded animate-pulse mb-4"></div>
            <div className="h-10 w-full bg-gray-700 rounded animate-pulse mb-4"></div>
            <div className="h-10 w-full bg-gray-700 rounded animate-pulse mb-4"></div>
            <div className="h-12 w-full bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <div className="h-6 w-40 bg-gray-700 rounded animate-pulse mb-4"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-full bg-gray-700 rounded animate-pulse mb-3"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
