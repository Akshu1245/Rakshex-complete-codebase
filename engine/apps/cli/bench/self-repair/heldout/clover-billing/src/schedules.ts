// Subscription Schedules + Promotion Codes, written the pre-Clover (Basil) way.
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export function yearlySchedule(customer: string, price: string) {
  return stripe.subscriptionSchedules.create({
    customer,
    start_date: 'now',
    end_behavior: 'release',
    phases: [{ items: [{ price, quantity: 1 }], iterations: 12 }],
  });
}

export function durationSchedule(id: string, price: string) {
  return stripe.subscriptionSchedules.update(id, {
    phases: [{ items: [{ price }], duration: { interval: 'month', interval_count: 6 } }],
  });
}

export function summerPromo() {
  return stripe.promotionCodes.create({ coupon: 'SUMMER', code: 'SUMMER25', max_redemptions: 100 });
}

const promoDefaults = { max_redemptions: 10, active: true };
export function vipPromo(code: string) {
  return stripe.promotionCodes.create({ ...promoDefaults, coupon: 'VIP', code });
}
