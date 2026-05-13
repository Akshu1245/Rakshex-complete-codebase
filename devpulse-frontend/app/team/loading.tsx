import { Skeleton, ListSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Invite form skeleton */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Team members list skeleton */}
        <Skeleton className="h-6 w-36 mb-4" />
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}
