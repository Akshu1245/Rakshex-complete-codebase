import axios from 'axios';
import { createSession, getStripe } from '../lib/client';
export async function cardCheckout() {
  return createSession({ mode: 'payment', payment_method_types: ['card'], line_items: [] });
}
export async function setupCheckout() {
  return createSession({ mode: 'setup', currency: 'eur' });
}
export async function intent(flag: boolean) {
  const types = flag ? ['card'] : ['ideal'];
  return getStripe().paymentIntents.create({ amount: 100, currency: 'usd', payment_method_types: types });
}
export async function plainCheckout() {
  return getStripe().checkout.sessions.create({ mode: 'payment', line_items: [], success_url: 'https://example.test/ok' });
}
export async function rawSetup(key: string) {
  return fetch('https://api.stripe.com/v1/setup_intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: new URLSearchParams({ 'payment_method_types[]': 'card' }),
  });
}
export async function otherApi() {
  return axios.post('https://api.example.com/v1/checkout/sessions', 'payment_method_types[]=card');
}
