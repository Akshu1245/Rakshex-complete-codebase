import IncidentTimeline from '@/components/IncidentTimeline';

export default function IncidentsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Incidents</h1>
        <p className="text-sm text-zinc-500 mt-1">Track and manage API incidents and outages.</p>
      </div>

      <IncidentTimeline />
    </div>
  );
}
