import { extractBearer, verifyJwt, hasEntitlement } from '../../_lib/auth';

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface TokenResponse {
  result: { token: string };
  success: boolean;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const uid = context.params.uid as string;
  const { CF_ACCOUNT_ID, CF_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env;

  const jwt = extractBearer(context.request);
  if (!jwt) {
    return new Response('Sign in required', { status: 401 });
  }

  const user = await verifyJwt(jwt, { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY });
  if (!user) {
    return new Response('Invalid session', { status: 401 });
  }

  const entitled = await hasEntitlement(user.user_id, { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY });
  if (!entitled) {
    return new Response('Payment required', { status: 402 });
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${uid}/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    return new Response(`Cloudflare error ${response.status}: ${errBody}`, { status: 502 });
  }

  const data: TokenResponse = await response.json();

  return Response.json(
    { token: data.result.token },
    { headers: { 'Cache-Control': 'no-store' } }
  );
};
