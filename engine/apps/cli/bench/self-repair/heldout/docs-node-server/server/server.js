// Pattern from Stripe's Node quickstarts: one-line client, Express routes.
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: req.body.priceId, quantity: 1 }],
    mode: 'payment',
    payment_method_types: ['card', 'ideal'],
    success_url: `${process.env.DOMAIN}/success.html`,
    cancel_url: `${process.env.DOMAIN}/cancel.html`,
  });
  res.redirect(303, session.url);
});

app.post('/create-payment-intent', async (req, res) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1099,
    currency: 'eur',
    automatic_payment_methods: { enabled: true },
  });
  res.send({ clientSecret: paymentIntent.client_secret });
});

app.post('/confirm/:id', async (req, res) => {
  const pi = await stripe.paymentIntents.confirm(req.params.id, {
    payment_method: req.body.paymentMethod,
    payment_method_types: ['card'],
  });
  res.send(pi);
});

app.post('/upgrade', async (req, res) => {
  const subscription = await stripe.subscriptions.update(req.body.subscriptionId, {
    items: [{ id: req.body.itemId, price: req.body.newPrice }],
    billing_cycle_anchor: 'now',
    proration_behavior: 'create_prorations',
  });
  res.send(subscription);
});

app.listen(4242);
