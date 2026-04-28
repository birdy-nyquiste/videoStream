import Stripe from 'stripe';
import { extractBearer, verifyJwt } from '../_lib/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_PRICE_ID } = context.env;

  const jwt = extractBearer(context.request);
  if (!jwt) return new Response('Sign in required', { status: 401 });

  const user = await verifyJwt(jwt, { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY });
  if (!user) return new Response('Invalid session', { status: 401 });

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const origin = new URL(context.request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.user_id,
    metadata: {
      user_id: user.user_id,
      email: user.email,
    },
    success_url: `${origin}/?paid=1`,
    cancel_url: `${origin}/`,
  });

  return Response.json({ url: session.url });
};
