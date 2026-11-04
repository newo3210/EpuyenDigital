import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@epuyen/shared';
import { readPublicEnv } from '@/infrastructure/env';

// Browser client - anon key + session cookies; used only by client components (RLS applies).
export function createBrowserSupabase() {
  const env = readPublicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
