import { shortCode, type Profile } from '@epuyen/shared';

import { errorReportSchema } from '@/contracts/errors';
import type { NewErrorLog } from '@/infrastructure/repositories/error-logs';
import { digestRef } from './digest-ref';
import { buildErrorLogRow } from './log-error';

// Rate limit - max stored client reports per user in the trailing window.
export const REPORT_RATE_LIMIT = 10;
export const REPORT_RATE_WINDOW_MS = 60_000;

// Body read result - parsed JSON (null when malformed) or a size-limit rejection.
export type ReportBody = { kind: 'json'; value: unknown } | { kind: 'too_large' };

// Store outcome - atomic count-and-insert result from the database.
export type ClientReportOutcome = 'stored' | 'rate_limited' | 'failed';

// Report request - lazy body reader (called only after auth and the advisory check) plus the middleware trace id.
export type ReportErrorRequest = {
  readBody: () => Promise<ReportBody>;
  headerTraceId: string | null;
};

// Report ports - session, active-profile lookup, advisory recent-report counter, and the atomic store.
export type ReportErrorDeps = {
  getSessionUserId: () => Promise<string | null>;
  findProfile: (userId: string) => Promise<Profile | null>;
  countRecentReports: (userId: string) => Promise<number>;
  storeReport: (row: NewErrorLog) => Promise<ClientReportOutcome>;
};

// Report outcome - HTTP status with a JSON body for the route handler.
export type ReportErrorResult =
  | { status: 201; body: { code: string } }
  | { status: 400 | 401 | 413 | 429 | 500; body: { error: string } };

const RATE_LIMITED: ReportErrorResult = { status: 429, body: { error: 'rate_limited' } };

// Client error report - auth, advisory limit, bounded body, schema, trace check, redacted row, atomic store.
export async function reportError(request: ReportErrorRequest, deps: ReportErrorDeps): Promise<ReportErrorResult> {
  const userId = await deps.getSessionUserId();
  const profile = userId ? await deps.findProfile(userId) : null;
  if (!profile?.isActive) return { status: 401, body: { error: 'unauthenticated' } };

  if ((await deps.countRecentReports(profile.id)) >= REPORT_RATE_LIMIT) return RATE_LIMITED;

  const body = await request.readBody();
  if (body.kind === 'too_large') return { status: 413, body: { error: 'too_large' } };

  const parsed = errorReportSchema.safeParse(body.value);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_body' } };

  const report = parsed.data;
  if (report.traceId !== request.headerTraceId) return { status: 400, body: { error: 'trace_mismatch' } };

  const row = buildErrorLogRow({
    source: 'web',
    level: 'error',
    message: report.message,
    details: {
      url: report.url,
      stack: report.stack,
      note: report.note,
      digestRef: digestRef(report.digest),
    },
    traceId: report.traceId,
    orgId: profile.orgId,
    userId: profile.id,
  });

  const outcome = await deps.storeReport(row);
  if (outcome === 'rate_limited') return RATE_LIMITED;
  if (outcome === 'failed') return { status: 500, body: { error: 'not_stored' } };

  return { status: 201, body: { code: shortCode(report.traceId) } };
}
