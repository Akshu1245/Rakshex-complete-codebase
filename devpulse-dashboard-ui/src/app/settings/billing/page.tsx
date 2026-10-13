import BillingPanel from '@/components/BillingPanel';
import PricingTable from '@/components/PricingTable';

export default function BillingPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Billing</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your subscription, view invoices, and upgrade plans.</p>
      </div>

      <BillingPanel />

      <section>
        <PricingTable />
      </section>
    </div>
  );
}
