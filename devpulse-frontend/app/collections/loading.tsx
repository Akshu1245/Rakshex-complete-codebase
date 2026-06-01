import { Skeleton } from "@/components/Skeleton";

export default function CollectionsLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Collection list skeleton */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-black/50 p-6 rounded-lg border border-gray-700 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-56 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
