import HealthMonitor from '@/components/HealthMonitor';

export default function HealthPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Health Monitor</h1>
        <p className="text-sm text-zinc-500 mt-1">Real-time API health status and latency monitoring.</p>
      </div>

      <HealthMonitor />
    </div>
  );
}
