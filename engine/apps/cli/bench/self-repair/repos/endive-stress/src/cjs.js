// CommonJS, factory call without `new` (supported by stripe-node).
const Stripe = require('stripe');
const s = Stripe(process.env.STRIPE_KEY);
exports.pay = () => s.checkout.sessions.create({ mode: 'payment', payment_method_types: ['card'], line_items: [] });
