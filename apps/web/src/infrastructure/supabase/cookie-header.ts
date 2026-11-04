import 'server-only';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { Database } from '@epuyen/shared';
import { readPublicEnv } from '@/infrastructure/env';

// Cookie-header client - read-only session client for code outside a request scope (e.g. onRequestError).
export function createCookieHeaderSupabase(cookieHeader: string) {
  const env = readPublicEnv();
  const cookies = parseCookieHeader(cookieHeader).map(({ name, value }) => ({ name, value: value ?? '' }));

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: () => {
        // Read-only - refreshed tokens are never written back from the error hook.
      },
    },
  });
}
