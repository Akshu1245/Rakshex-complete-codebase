import CompatibilityChecker from '@/components/CompatibilityChecker';
import OpenAPIImport from '@/components/OpenAPIImport';

export default function CompatibilityPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Compatibility Checker</h1>
        <p className="text-sm text-zinc-500 mt-1">Check API compatibility and import OpenAPI specifications.</p>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompatibilityChecker />
        <OpenAPIImport />
      </section>
    </div>
  );
}
