import { createClient } from '@supabase/supabase-js';

export interface AuthEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export interface AuthedUser {
  user_id: string;
  email: string;
}

export const extractBearer = (request: Request): string | null => {
  const header = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

export const verifyJwt = async (
  jwt: string,
  env: AuthEnv
): Promise<AuthedUser | null> => {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(jwt);
  if (error || !data.user || !data.user.email) return null;
  return { user_id: data.user.id, email: data.user.email };
};

export const serviceClient = (env: AuthEnv) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const hasEntitlement = async (
  user_id: string,
  env: AuthEnv
): Promise<boolean> => {
  const client = serviceClient(env);
  const { data, error } = await client
    .from('entitlements')
    .select('user_id')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) return false;
  return !!data;
};
