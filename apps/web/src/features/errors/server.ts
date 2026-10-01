import 'server-only';

import { insertErrorLog } from '@/infrastructure/repositories/error-logs';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { logError, type LogErrorInput } from './log-error';

// Server error logger - service-role insert (RLS allows no client inserts) with console fallback.
export function logServerError(input: LogErrorInput): Promise<string | null> {
  return logError(input, {
    insert: (row) => insertErrorLog(createAdminSupabase(), row),
    fallback: (message, data) => console.error(message, data),
  });
}
