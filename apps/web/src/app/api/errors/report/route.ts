import { NextResponse, type NextRequest } from 'next/server';
import { TRACE_HEADER } from '@epuyen/shared';

import { REPORT_RATE_WINDOW_MS, reportError } from '@/features/errors/report-error';
import { logServerError } from '@/features/errors/server';
import { getSessionUserId } from '@/infrastructure/auth/session';
import { readBoundedJson } from '@/infrastructure/http/read-bounded-json';
import { countRecentClientReports } from '@/infrastructure/repositories/error-logs';
import { findProfileById } from '@/infrastructure/repositories/profiles';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';

// Client error report endpoint - thin HTTP adapter; the body is read only after auth and rate checks.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const result = await reportError(
    { readBody: () => readBoundedJson(request), headerTraceId: request.headers.get(TRACE_HEADER) },
    {
      getSessionUserId: () => getSessionUserId(supabase),
      findProfile: (userId) => findProfileById(createAdminSupabase(), userId),
      countRecentReports: (userId) =>
        countRecentClientReports(
          createAdminSupabase(),
          userId,
          new Date(Date.now() - REPORT_RATE_WINDOW_MS).toISOString(),
        ),
      log: logServerError,
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
