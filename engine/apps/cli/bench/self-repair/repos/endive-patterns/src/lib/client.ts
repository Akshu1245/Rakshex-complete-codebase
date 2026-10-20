// SYNTHETIC FIXTURE. Client construction + wrappers.
import Stripe from 'stripe';
const client = new Stripe(process.env.STRIPE_KEY as string);
export function getStripe() {
  return client;
}
export async function createSession(params: Stripe.Checkout.SessionCreateParams) {
  return client.checkout.sessions.create(params);
}
export class Billing {
  constructor(private readonly s: Stripe) {}
  setup(customer: string) {
    return this.s.setupIntents.create({ customer, payment_method_types: ['sepa_debit'] });
  }
}
