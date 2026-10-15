// Next.js route-handler style with a module-level client.
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const { customer } = await request.json();
  const session = await stripe.financialConnections.sessions.create({
    account_holder: { type: 'customer', customer },
    permissions: ['balances', 'payment_method'],
    filters: { countries: ['US'] },
  });
  return Response.json({ client_secret: session.client_secret });
}

export async function GET() {
  const prices = await stripe.prices.list({ active: true, limit: 10 });
  return Response.json(prices.data);
}
