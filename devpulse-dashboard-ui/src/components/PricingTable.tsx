'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Shared';
import { Button } from '@/components/ui/Button';

const plans = [
  {
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'For individual developers exploring AI APIs',
    features: [
      '5 security scans / day',
      'Basic cost tracking',
      '1 API key',
      'Community support',
    ],
    cta: 'Current Plan',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 29,
    period: '/month',
    description: 'For developers serious about API security & costs',
    features: [
      'Unlimited security scans',
      'Full cost intelligence dashboard',
      'AI fix suggestions (Groq-powered)',
      'Budget forecasting & anomaly alerts',
      '10 API keys',
      'Real-time threat feed',
      'VS Code extension (full)',
      'Email support',
    ],
    cta: 'Start 14-Day Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: 99,
    period: '/month',
    description: 'For teams managing multiple AI API providers',
    features: [
      'Everything in Pro',
      'Team workspaces & RBAC',
      'CI/CD security gates',
      'Unlimited API keys',
      'Custom alert channels',
      'SSO & audit logs',
      'Priority support',
      'API access',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function PricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <Card>
      <CardHeader
        title="Simple, Transparent Pricing"
        subtitle="Stop API breaches. Cut costs by 40%. Start free."
        icon={
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <div className="flex items-center justify-center gap-3 mb-6">
        <span className={`text-sm ${!annual ? 'text-white' : 'text-zinc-500'}`}>Monthly</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-emerald-500' : 'bg-zinc-700'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
        <span className={`text-sm ${annual ? 'text-white' : 'text-zinc-500'}`}>
          Annual <Badge variant="success" className="ml-1">save 20%</Badge>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const displayPrice = annual ? Math.round(plan.price * 0.8) : plan.price;
          return (
            <div
              key={plan.name}
              className={`rounded-2xl p-5 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-violet-500/10 to-emerald-500/10 border-2 border-violet-500/40 relative'
                  : 'bg-zinc-800/40 border border-zinc-700/40'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Most Popular
                </span>
              )}
              <h4 className="text-lg font-bold text-white">{plan.name}</h4>
              <div className="mt-2 mb-3">
                {plan.price === 0 ? (
                  <span className="text-3xl font-black text-white tabular-nums">Free</span>
                ) : (
                  <>
                    <span className="text-3xl font-black text-white tabular-nums">${displayPrice}</span>
                    <span className="text-sm text-zinc-500">{plan.period}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-zinc-400 mb-4">{plan.description}</p>
              <Button
                variant={plan.highlighted ? 'primary' : 'secondary'}
                className={`w-full ${plan.highlighted ? 'bg-gradient-to-r from-violet-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400' : ''}`}
              >
                {plan.cta}
              </Button>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
