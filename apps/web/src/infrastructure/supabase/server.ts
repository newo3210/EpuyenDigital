import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@epuyen/shared';
import { cookies } from 'next/headers';
import { readPublicEnv } from '@/infrastructure/env';

// Server client - per-request client bound to the caller's auth cookies (RLS applies).
export async function createServerSupabase() {
  const env = readPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; middleware refreshes the session instead.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
