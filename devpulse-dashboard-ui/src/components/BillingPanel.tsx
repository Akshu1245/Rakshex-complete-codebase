'use client';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardHeader, CardSkeleton } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

interface Plan {
  name: string;
  price_monthly: number;
  price_yearly: number;
  api_calls_day: number;
  features: string[];
}

export default function BillingPanel() {
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [currentPlan, setCurrentPlan] = useState('free');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [plansRes, statusRes] = await Promise.all([
          apiClient.getBillingPlans(),
          apiClient.getBillingStatus(),
        ]);
        if (plansRes.plans) setPlans(plansRes.plans);
        if (statusRes.plan) setCurrentPlan(statusRes.plan as string);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleSubscribe = async (plan: string) => {
    setSubscribing(plan);
    setMessage('');
    try {
      const res = await apiClient.subscribePlan(plan, billingPeriod);
      if (res.status === 'success') {
        setCurrentPlan(plan);
        setMessage(`Subscribed to ${plan} plan!`);
      } else {
        setMessage(res.message || 'Failed to subscribe');
      }
    } catch { setMessage('Error subscribing'); }
    setSubscribing('');
  };

  const handleCancel = async () => {
    try {
      const res = await apiClient.cancelSubscription();
      if (res.status === 'success') {
        setCurrentPlan('free');
        setMessage('Subscription cancelled');
      }
    } catch { setMessage('Error cancelling'); }
  };

  if (loading) return <CardSkeleton rows={5} />;

  const planOrder = ['free', 'pro', 'enterprise'];
  const tierColors: Record<string, string> = {
    free: 'border-zinc-700/40',
    pro: 'border-violet-500/30 shadow-violet-500/5 shadow-lg',
    enterprise: 'border-emerald-500/30 shadow-emerald-500/5 shadow-lg',
  };

  return (
    <Card>
      <CardHeader
        title="Billing & Plans"
        subtitle={<>Current: <span className="text-emerald-400 font-medium">{currentPlan.toUpperCase()}</span></>}
        icon={
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        }
        action={
          <div className="flex items-center gap-1 bg-zinc-800/60 rounded-xl p-0.5 text-xs border border-zinc-700/30">
            <button onClick={() => setBillingPeriod('monthly')} className={`px-3 py-1.5 rounded-lg transition-all ${billingPeriod === 'monthly' ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 border border-transparent'}`}>Monthly</button>
            <button onClick={() => setBillingPeriod('yearly')} className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${billingPeriod === 'yearly' ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 border border-transparent'}`}>
              Yearly <Badge variant="success">-17%</Badge>
            </button>
          </div>
        }
      />

      {message && <p className="text-xs text-emerald-400 mb-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planOrder.map((key) => {
          const plan = plans[key];
          if (!plan) return null;
          const price = billingPeriod === 'monthly' ? plan.price_monthly : plan.price_yearly;
          const isCurrent = currentPlan === key;
          return (
            <div key={key} className={`border rounded-2xl p-5 transition-all ${tierColors[key] || 'border-zinc-700/40'} ${isCurrent ? 'bg-zinc-800/30' : 'bg-zinc-900/20'}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold text-sm">{plan.name}</h4>
                {isCurrent && <Badge variant="success">CURRENT</Badge>}
              </div>
              <div className="mb-3">
                <span className="text-2xl font-bold text-white tabular-nums">${price}</span>
                <span className="text-zinc-500 text-xs">/{billingPeriod === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
              <p className="text-zinc-500 text-xs mb-3 tabular-nums">{plan.api_calls_day.toLocaleString()} API calls/day</p>
              <ul className="space-y-1.5 mb-4">
                {plan.features.slice(0, 5).map((f, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </li>
                ))}
                {plan.features.length > 5 && <li className="text-[10px] text-zinc-500 pl-5">+{plan.features.length - 5} more</li>}
              </ul>
              {isCurrent ? (
                key !== 'free' ? (
                  <Button variant="danger" size="sm" onClick={handleCancel} className="w-full">
                    Cancel Plan
                  </Button>
                ) : null
              ) : (
                <Button
                  variant={key === 'pro' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleSubscribe(key)}
                  disabled={!!subscribing}
                  loading={subscribing === key}
                  className="w-full"
                >
                  {subscribing === key ? 'Processing...' : key === 'free' ? 'Downgrade' : 'Upgrade'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
