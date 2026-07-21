export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-40 bg-black/50 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-black/40 rounded border border-gray-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
