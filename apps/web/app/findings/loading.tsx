export default function FindingsLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-black/50 rounded" />
        <div className="h-4 w-72 bg-black/40 rounded" />
        <div className="h-64 bg-black/40 rounded border border-gray-800" />
      </div>
    </div>
  );
}
