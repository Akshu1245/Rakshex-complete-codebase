import axios from 'axios';
// Case C: raw HTTP call to the same endpoint (form-encoded), no SDK
export async function rawCheckout(key: string) {
  return axios.post('https://api.stripe.com/v1/checkout/sessions', 'mode=payment&payment_method_types[]=card', { headers: { Authorization: `Bearer ${key}` } });
}
