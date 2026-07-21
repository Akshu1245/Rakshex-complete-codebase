export default function ControlPlaneLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-black/50 rounded" />
        <div className="h-96 bg-black/40 rounded border border-gray-800" />
      </div>
    </div>
  );
}
