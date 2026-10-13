import AlertManager from '@/components/AlertManager';
import ChangeAlerts from '@/components/ChangeAlerts';

export default function AlertsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Alerts</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage alert rules and view API change notifications.</p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertManager />
        <ChangeAlerts />
      </section>
    </div>
  );
}
