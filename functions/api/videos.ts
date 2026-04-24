interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface StreamVideo {
  uid: string;
  meta: { name?: string; creator?: string };
  thumbnail: string;
  duration: number;
  allowedOrigins?: string[];
}

interface StreamApiResponse {
  result: StreamVideo[];
  success: boolean;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { CF_ACCOUNT_ID, CF_API_TOKEN } = context.env;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`,
    {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    return new Response('Failed to fetch videos', { status: 502 });
  }

  const data: StreamApiResponse = await response.json();

  const videos = data.result.map((v) => ({
    uid: v.uid,
    title: v.meta?.name || v.uid,
    creator: v.meta?.creator,
    thumbnail: v.thumbnail,
    duration: v.duration,
    allowedOrigins: v.allowedOrigins ?? [],
  }));

  return Response.json(videos, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
};
