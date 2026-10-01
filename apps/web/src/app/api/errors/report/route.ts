import { NextResponse, type NextRequest } from 'next/server';
import { TRACE_HEADER } from '@epuyen/shared';

import { reportError } from '@/features/errors/report-error';
import { logServerError } from '@/features/errors/server';
import { getSessionUserId } from '@/infrastructure/auth/session';
import { findProfileById } from '@/infrastructure/repositories/profiles';
import { createAdminSupabase } from '@/infrastructure/supabase/admin';
import { createServerSupabase } from '@/infrastructure/supabase/server';

// Body reader - malformed JSON becomes an invalid body (400) instead of a crash.
async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Client error report endpoint - thin HTTP adapter over the reportError use case.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const result = await reportError(
    { body: await readJson(request), headerTraceId: request.headers.get(TRACE_HEADER) },
    {
      getSessionUserId: () => getSessionUserId(supabase),
      findProfile: (userId) => findProfileById(createAdminSupabase(), userId),
      log: logServerError,
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
