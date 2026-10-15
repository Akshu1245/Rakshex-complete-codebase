import { stripe } from '../lib/stripe';
// Case B: param built dynamically (harder: spread object)
const base = { payment_method_types: ['card', 'link'] };
export async function charge(amount: number) {
  return stripe.paymentIntents.create({ amount, currency: 'usd', ...base });
}
