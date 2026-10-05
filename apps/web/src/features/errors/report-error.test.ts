import type { Profile } from '@epuyen/shared';
import type { NewErrorLog } from '@/infrastructure/repositories/error-logs';
import { digestRef } from './digest-ref';
import { logError } from './log-error';
import {
  REPORT_RATE_LIMIT,
  reportError,
  type ReportBody,
  type ReportErrorDeps,
  type ReportErrorRequest,
} from './report-error';

const TRACE_ID = 'f3b1c2d4-0000-4000-8000-000000000001';

const PROFILE: Profile = {
  id: '00000000-0000-4000-8000-0000000000a1',
  orgId: 'aaaaaaaa-0000-4000-8000-000000000001',
  fullName: 'Operador Prueba',
  role: 'operator',
  avatarPath: null,
  isActive: true,
};

const VALID_BODY = {
  traceId: TRACE_ID,
  message: 'Cannot read properties of undefined (DNI 30123456)',
  stack: 'TypeError at render (tel 2945123456)',
  url: 'http://localhost:3000/inbox',
  note: 'mi token=abc',
  digest: '12345',
};

// Request builder - lazy body reader spy plus the middleware trace header.
function makeRequest(body: unknown, headerTraceId: string | null = TRACE_ID, read?: ReportBody) {
  const readBody = vi.fn<() => Promise<ReportBody>>(async () => read ?? { kind: 'json', value: body });
  const request: ReportErrorRequest = { readBody, headerTraceId };
  return { request, readBody };
}

// Test deps - session, profile, recent-report counter, and real redacting logger over a fake insert.
function makeDeps(overrides: Partial<ReportErrorDeps> = {}) {
  const insert = vi.fn<(row: NewErrorLog) => Promise<string>>(async () => 'log-id-1');
  const countRecentReports = vi.fn<(userId: string) => Promise<number>>(async () => 0);
  const deps: ReportErrorDeps = {
    getSessionUserId: async () => PROFILE.id,
    findProfile: async () => PROFILE,
    countRecentReports,
    log: (input) => logError(input, { insert, fallback: () => {} }),
    ...overrides,
  };
  return { deps, insert, countRecentReports };
}

// Authentication - only active operators may report; the body is never read before that.
describe('reportError - authentication', () => {
  it('responds 401 without a session and never reads the body', async () => {
    const { deps, insert } = makeDeps({ getSessionUserId: async () => null });
    const { request, readBody } = makeRequest(VALID_BODY);

    const result = await reportError(request, deps);

    expect(result.status).toBe(401);
    expect(readBody).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('responds 401 for an inactive or missing profile', async () => {
    const inactive = makeDeps({ findProfile: async () => ({ ...PROFILE, isActive: false }) });
    const missing = makeDeps({ findProfile: async () => null });

    expect((await reportError(makeRequest(VALID_BODY).request, inactive.deps)).status).toBe(401);
    expect((await reportError(makeRequest(VALID_BODY).request, missing.deps)).status).toBe(401);
  });
});

// Abuse limits - per-user rate limit and body size cap store nothing.
describe('reportError - limits', () => {
  it(`responds 429 once ${REPORT_RATE_LIMIT} reports were stored in the last minute`, async () => {
    const { deps, insert, countRecentReports } = makeDeps();
    countRecentReports.mockResolvedValueOnce(REPORT_RATE_LIMIT);
    const { request, readBody } = makeRequest(VALID_BODY);

    const result = await reportError(request, deps);

    expect(result).toEqual({ status: 429, body: { error: 'rate_limited' } });
    expect(countRecentReports).toHaveBeenCalledWith(PROFILE.id);
    expect(readBody).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('accepts a report just under the limit', async () => {
    const { deps, countRecentReports } = makeDeps();
    countRecentReports.mockResolvedValueOnce(REPORT_RATE_LIMIT - 1);

    expect((await reportError(makeRequest(VALID_BODY).request, deps)).status).toBe(201);
  });

  it('responds 413 for an oversized body', async () => {
    const { deps, insert } = makeDeps();
    const { request } = makeRequest(null, TRACE_ID, { kind: 'too_large' });

    const result = await reportError(request, deps);

    expect(result).toEqual({ status: 413, body: { error: 'too_large' } });
    expect(insert).not.toHaveBeenCalled();
  });
});

// Validation - malformed bodies and mismatched trace ids store nothing.
describe('reportError - validation', () => {
  it('responds 400 for an invalid body', async () => {
    const { deps, insert } = makeDeps();

    const result = await reportError(makeRequest({ ...VALID_BODY, note: 'x'.repeat(501) }).request, deps);

    expect(result.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('responds 400 for a non-object body', async () => {
    const { deps } = makeDeps();

    expect((await reportError(makeRequest(null).request, deps)).status).toBe(400);
  });

  it('responds 400 when the body trace id differs from the header', async () => {
    const { deps, insert } = makeDeps();

    const result = await reportError(makeRequest(VALID_BODY, 'other-trace-id-123').request, deps);

    expect(result.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});

// Happy path - redacted client-origin web row linked to the operator and organization.
describe('reportError - stored report', () => {
  it('responds 201 and stores a redacted web error', async () => {
    const { deps, insert } = makeDeps();

    const result = await reportError(makeRequest(VALID_BODY).request, deps);

    expect(result).toEqual({ status: 201, body: { code: 'F3B1C2D4' } });
    const row = insert.mock.calls[0]?.[0];
    expect(row).toMatchObject({ source: 'web', level: 'error', traceId: TRACE_ID, orgId: PROFILE.orgId, userId: PROFILE.id });
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('30123456');
    expect(serialized).not.toContain('2945123456');
    expect(serialized).not.toContain('token=abc');
    expect(row?.details).toMatchObject({ origin: 'client', url: VALID_BODY.url, digestRef: digestRef('12345') });
    expect(row?.details).not.toHaveProperty('digest');
  });

  it('responds 500 when the row could not be stored', async () => {
    const { deps } = makeDeps({ log: async () => null });

    const result = await reportError(makeRequest(VALID_BODY).request, deps);

    expect(result.status).toBe(500);
  });
});
