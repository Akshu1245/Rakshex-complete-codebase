import CodeGenerator from '@/components/CodeGenerator';
import CodeHistory from '@/components/CodeHistory';

export default function GeneratePage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">AI Code Generator</h1>
        <p className="text-sm text-zinc-500 mt-1">Generate production-ready API integration code with AI.</p>
      </div>

      <CodeGenerator />

      <section>
        <CodeHistory />
      </section>
    </div>
  );
}
