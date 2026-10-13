import CICDPanel from '@/components/CICDPanel';

export default function CICDPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">CI/CD Pipeline</h1>
        <p className="text-sm text-zinc-500 mt-1">Monitor and manage your CI/CD pipeline integrations.</p>
      </div>

      <CICDPanel />
    </div>
  );
}
