import 'server-only';

import { getSessionUserId } from '@/infrastructure/auth/session';
import { insertErrorLog } from '@/infrastructure/repositories/error-logs';
import { findProfileById } from '@/infrastructure/repositories/profiles';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createCookieHeaderSupabase } from '@/infrastructure/supabase/cookie-header';
import type { RequestOperator } from './attach-operator';
import { logError, type LogErrorInput } from './log-error';

// Server error logger - service-role insert (RLS allows no client inserts) with console fallback.
export function logServerError(input: LogErrorInput): Promise<string | null> {
  return logError(input, {
    insert: (row) => insertErrorLog(createAdminSupabase(), row),
    fallback: (message, data) => console.error(message, data),
  });
}

// Operator resolver - session user from the cookie header, then the active profile via the admin client.
export async function resolveOperatorFromCookieHeader(cookieHeader: string): Promise<RequestOperator | null> {
  const userId = await getSessionUserId(createCookieHeaderSupabase(cookieHeader));
  if (!userId) return null;
  const profile = await findProfileById(createAdminSupabase(), userId);
  return profile?.isActive ? { orgId: profile.orgId, userId: profile.id } : null;
}
