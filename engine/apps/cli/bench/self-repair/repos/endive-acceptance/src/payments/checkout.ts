import { stripe } from '../lib/stripe';
// Case A: direct SDK call through a wrapper module, static param (should be detected)
export async function checkout(lineItems: any[], email: string) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: 'https://example.test/thanks',
  });
}
