import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@epuyen/shared';
import { readServerEnv } from '@/infrastructure/env';

// Admin client - service role, bypasses RLS; server-only (importing it from client code fails the build).
export function createAdminSupabase() {
  const env = readServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AdminSupabase = ReturnType<typeof createAdminSupabase>;
