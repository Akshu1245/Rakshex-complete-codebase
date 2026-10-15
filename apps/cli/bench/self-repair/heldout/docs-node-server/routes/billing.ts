import Stripe from 'stripe';

export class BillingService {
  private stripe: Stripe;
  constructor(key: string) {
    this.stripe = new Stripe(key);
  }

  async preview(customer: string, subscription: string) {
    return this.stripe.invoices.createPreview({
      customer,
      subscription,
      subscription_details: { billing_cycle_anchor: 'now', proration_behavior: 'always_invoice' },
    });
  }

  async resume(id: string) {
    return this.stripe.subscriptions.resume(id, { billing_cycle_anchor: 'unchanged' });
  }

  async savePaymentMethod(customer: string) {
    return this.stripe.setupIntents.create({ customer, automatic_payment_methods: { enabled: true } });
  }
}
