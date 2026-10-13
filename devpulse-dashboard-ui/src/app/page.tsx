import DashboardStats from '@/components/DashboardStats';
import HealthMonitor from '@/components/HealthMonitor';
import SecurityScoreCard from '@/components/SecurityScoreCard';
import CostIntelligenceDashboard from '@/components/CostIntelligenceDashboard';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import ChangeAlerts from '@/components/ChangeAlerts';

export default function Home() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Monitor your API security, costs, and health at a glance.</p>
      </div>

      {/* Onboarding — dismissible */}
      <OnboardingChecklist />

      {/* KPI Metrics */}
      <section>
        <DashboardStats />
      </section>

      {/* Two-column: Security Score + Cost Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityScoreCard />
        <CostIntelligenceDashboard />
      </section>

      {/* Two-column: Health Monitor + Change Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HealthMonitor />
        <ChangeAlerts />
      </section>
    </div>
  );
}
