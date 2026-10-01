import { shortCode, type Profile } from '@epuyen/shared';

import { errorReportSchema } from '@/contracts/errors';
import { digestRef } from './digest-ref';
import type { LogErrorInput } from './log-error';

// Report request - raw JSON body plus the trace id resolved by the middleware.
export type ReportErrorRequest = {
  body: unknown;
  headerTraceId: string | null;
};

// Report ports - session, active-profile lookup and the redacting logger.
export type ReportErrorDeps = {
  getSessionUserId: () => Promise<string | null>;
  findProfile: (userId: string) => Promise<Profile | null>;
  log: (input: LogErrorInput) => Promise<string | null>;
};

// Report outcome - HTTP status with a JSON body for the route handler.
export type ReportErrorResult =
  | { status: 201; body: { code: string } }
  | { status: 400 | 401 | 500; body: { error: string } };

// Client error report - authenticates, validates, checks the trace id, stores a redacted web row.
export async function reportError(request: ReportErrorRequest, deps: ReportErrorDeps): Promise<ReportErrorResult> {
  const userId = await deps.getSessionUserId();
  const profile = userId ? await deps.findProfile(userId) : null;
  if (!profile?.isActive) return { status: 401, body: { error: 'unauthenticated' } };

  const parsed = errorReportSchema.safeParse(request.body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_body' } };

  const report = parsed.data;
  if (report.traceId !== request.headerTraceId) return { status: 400, body: { error: 'trace_mismatch' } };

  const id = await deps.log({
    source: 'web',
    level: 'error',
    message: report.message,
    details: { url: report.url, stack: report.stack, note: report.note, digestRef: digestRef(report.digest) },
    traceId: report.traceId,
    orgId: profile.orgId,
    userId: profile.id,
  });
  if (!id) return { status: 500, body: { error: 'not_stored' } };

  return { status: 201, body: { code: shortCode(report.traceId) } };
}
