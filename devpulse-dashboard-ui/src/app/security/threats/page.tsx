import ThreatFeed from '@/components/ThreatFeed';

export default function ThreatsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Threat Feed</h1>
        <p className="text-sm text-zinc-500 mt-1">Real-time threat intelligence and vulnerability alerts.</p>
      </div>

      <ThreatFeed />
    </div>
  );
}
