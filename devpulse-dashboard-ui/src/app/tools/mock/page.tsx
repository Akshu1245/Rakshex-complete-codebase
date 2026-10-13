import MockServer from '@/components/MockServer';

export default function MockPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Mock Server</h1>
        <p className="text-sm text-zinc-500 mt-1">Create and manage mock API endpoints for testing.</p>
      </div>

      <MockServer />
    </div>
  );
}
