// Decoys: must NOT be flagged.
import { getStripe } from '../lib/client';
const stripe = { checkout: { sessions: { create: (x: unknown) => x } } };
export const local = () => stripe.checkout.sessions.create({ payment_method_types: ['card'] });
export const read = () => getStripe().paymentIntents.retrieve('pi_123');
export const label = 'payment_method_types';
