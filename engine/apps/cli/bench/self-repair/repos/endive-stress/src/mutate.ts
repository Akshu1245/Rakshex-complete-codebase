import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_KEY as string);
export async function build(eu: boolean) {
  const params: Record<string, unknown> = { mode: 'payment', line_items: [] };
  if (eu) params.payment_method_types = ['ideal'];
  return stripe.checkout.sessions.create(params as any);
}
export async function fromHelper() {
  return stripe.setupIntents.create({ ...defaults(), customer: 'cus_1' });
}
function defaults() { return { payment_method_types: ['card'] }; }
