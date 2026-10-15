import type Stripe from 'stripe';
export async function handler(deps: { stripe: Stripe }) {
  return deps.stripe.paymentIntents.create({ amount: 1, currency: 'usd', payment_method_types: ['card'] });
}
