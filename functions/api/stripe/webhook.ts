import Stripe from 'stripe';
import { serviceClient } from '../../_lib/auth';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = context.env;

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = context.request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const payload = await context.request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== 'paid') {
    return new Response('not paid', { status: 200 });
  }

  const user_id = session.client_reference_id || session.metadata?.user_id;
  const email = session.customer_email || session.customer_details?.email || session.metadata?.email;

  if (!user_id || !email) {
    return new Response('missing user_id or email on session', { status: 400 });
  }

  const stripe_customer_id =
    typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

  const supabase = serviceClient({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY });

  const { error } = await supabase
    .from('entitlements')
    .upsert(
      {
        user_id,
        email,
        stripe_customer_id,
        stripe_session_id: session.id,
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );

  if (error) {
    return new Response(`db error: ${error.message}`, { status: 500 });
  }

  return new Response('ok', { status: 200 });
};
