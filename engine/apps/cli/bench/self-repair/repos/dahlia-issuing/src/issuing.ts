// SYNTHETIC FIXTURE for Stripe v2203 (2026-02-25.clover) -> v2204 (2026-03-25.dahlia).
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_KEY as string);
export const elevated = () =>
  stripe.testHelpers.issuing.authorizations.create({ amount: 100, card: 'ic_test', risk_assessment: { card_testing_risk: { risk_level: 'elevated' } } });
export const plain = () => stripe.testHelpers.issuing.authorizations.create({ amount: 100, card: 'ic_test' });
export const raw = (key: string) =>
  fetch('https://api.stripe.com/v1/test_helpers/issuing/authorizations', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: 'amount=100&card=ic_test&risk_assessment[merchant_dispute_risk][risk_level]=high' });
