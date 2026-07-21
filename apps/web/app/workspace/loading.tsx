export default function WorkspaceLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-black/50 rounded" />
        <div className="h-48 bg-black/40 rounded border border-gray-800" />
      </div>
    </div>
  );
}
