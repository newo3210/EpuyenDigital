import 'server-only';

import { redactText } from '@epuyen/shared';

import { getSessionUserId } from '@/infrastructure/auth/session';
import { insertClientErrorReport, insertErrorLog, type NewErrorLog } from '@/infrastructure/repositories/error-logs';
import { findProfileById } from '@/infrastructure/repositories/profiles';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createCookieHeaderSupabase } from '@/infrastructure/supabase/cookie-header';
import type { RequestOperator } from './attach-operator';
import { logError, type LogErrorInput } from './log-error';
import { REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_MS, type ClientReportOutcome } from './report-error';

// Server error logger - service-role insert (RLS allows no client inserts) with console fallback.
export function logServerError(input: LogErrorInput): Promise<string | null> {
  return logError(input, {
    insert: (row) => insertErrorLog(createAdminSupabase(), row),
    fallback: (message, data) => console.error(message, data),
  });
}

// Client report store - atomic per-user count-and-insert (service role); failures go to the console redacted.
export async function storeClientReport(row: NewErrorLog): Promise<ClientReportOutcome> {
  try {
    const id = await insertClientErrorReport(createAdminSupabase(), row, {
      limit: REPORT_RATE_LIMIT,
      windowSeconds: REPORT_RATE_WINDOW_MS / 1000,
    });
    return id ? 'stored' : 'rate_limited';
  } catch (cause) {
    console.error('client error report insert failed', {
      traceId: row.traceId,
      cause: cause instanceof Error ? redactText(cause.message) : 'unknown',
    });
    return 'failed';
  }
}

// Operator resolver - session user from the cookie header, then the active profile via the admin client.
export async function resolveOperatorFromCookieHeader(cookieHeader: string): Promise<RequestOperator | null> {
  const userId = await getSessionUserId(createCookieHeaderSupabase(cookieHeader));
  if (!userId) return null;
  const profile = await findProfileById(createAdminSupabase(), userId);
  return profile?.isActive ? { orgId: profile.orgId, userId: profile.id } : null;
}
