import ReportsExport from '@/components/ReportsExport';

export default function ReportsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Reports</h1>
        <p className="text-sm text-zinc-500 mt-1">Generate and export detailed reports for your API ecosystem.</p>
      </div>

      <ReportsExport />
    </div>
  );
}
