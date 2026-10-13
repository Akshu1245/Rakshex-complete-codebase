import Marketplace from '@/components/Marketplace';

export default function MarketplacePage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Marketplace</h1>
        <p className="text-sm text-zinc-500 mt-1">Discover and install API integrations and extensions.</p>
      </div>

      <Marketplace />
    </div>
  );
}
