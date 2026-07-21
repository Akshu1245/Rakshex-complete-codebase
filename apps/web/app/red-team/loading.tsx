export default function RedTeamLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-black/50 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-black/40 rounded border border-gray-800" />
          ))}
        </div>
        <div className="h-72 bg-black/40 rounded border border-gray-800" />
      </div>
    </div>
  );
}
