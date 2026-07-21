export default function NotificationsLoading() {
  return (
    <div className="min-h-screen bg-transparent text-white p-8">
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-black/50 rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-black/40 rounded border border-gray-800" />
        ))}
      </div>
    </div>
  );
}
