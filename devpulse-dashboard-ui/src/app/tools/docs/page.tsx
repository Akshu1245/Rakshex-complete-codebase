import DocsSearch from '@/components/DocsSearch';

export default function DocsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">API Documentation</h1>
        <p className="text-sm text-zinc-500 mt-1">Search and explore API documentation with AI-powered summaries.</p>
      </div>

      <DocsSearch />
    </div>
  );
}
