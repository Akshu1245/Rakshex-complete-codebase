import SecurityScanner from '@/components/SecurityScanner';

export default function ScannerPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Security Scanner</h1>
        <p className="text-sm text-zinc-500 mt-1">Scan your API code for vulnerabilities, token leaks, and agent attacks.</p>
      </div>

      <SecurityScanner />
    </div>
  );
}
