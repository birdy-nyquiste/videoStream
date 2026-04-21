interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface TokenResponse {
  result: { token: string };
  success: boolean;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const uid = context.params.uid as string;
  const { CF_ACCOUNT_ID, CF_API_TOKEN } = context.env;

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
