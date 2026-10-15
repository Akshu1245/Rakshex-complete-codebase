// Dynamic: engine must report UNKNOWN, not "not affected".
import { getStripe } from '../lib/client';
export async function fromJson(raw: string) {
  return getStripe().checkout.sessions.create(JSON.parse(raw));
}
export async function passthrough(opts: Record<string, unknown>) {
  return getStripe().paymentIntents.create({ amount: 1, currency: 'usd', ...opts });
}
export async function computed(resource: 'paymentIntents' | 'setupIntents') {
  return (getStripe() as any)[resource].create({ payment_method_types: ['card'] });
}
