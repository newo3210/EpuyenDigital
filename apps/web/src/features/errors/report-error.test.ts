import type { Profile } from '@epuyen/shared';
import type { NewErrorLog } from '@/infrastructure/repositories/error-logs';
import { logError } from './log-error';
import { reportError, type ReportErrorDeps } from './report-error';

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

// Test deps - session lookup, profile lookup, and real redacting logger over a fake insert.
function makeDeps(overrides: Partial<ReportErrorDeps> = {}) {
  const insert = vi.fn<(row: NewErrorLog) => Promise<string>>(async () => 'log-id-1');
  const deps: ReportErrorDeps = {
    getSessionUserId: async () => PROFILE.id,
    findProfile: async () => PROFILE,
    log: (input) => logError(input, { insert, fallback: () => {} }),
    ...overrides,
  };
  return { deps, insert };
}

// Authentication - only active operators may report.
describe('reportError - authentication', () => {
  it('responds 401 without a session', async () => {
    const { deps, insert } = makeDeps({ getSessionUserId: async () => null });

    const result = await reportError({ body: VALID_BODY, headerTraceId: TRACE_ID }, deps);

    expect(result.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });

  it('responds 401 for an inactive or missing profile', async () => {
    const inactive = makeDeps({ findProfile: async () => ({ ...PROFILE, isActive: false }) });
    const missing = makeDeps({ findProfile: async () => null });

    expect((await reportError({ body: VALID_BODY, headerTraceId: TRACE_ID }, inactive.deps)).status).toBe(401);
    expect((await reportError({ body: VALID_BODY, headerTraceId: TRACE_ID }, missing.deps)).status).toBe(401);
  });
});

// Validation - malformed bodies and mismatched trace ids store nothing.
describe('reportError - validation', () => {
  it('responds 400 for an invalid body', async () => {
    const { deps, insert } = makeDeps();

    const result = await reportError({ body: { ...VALID_BODY, note: 'x'.repeat(501) }, headerTraceId: TRACE_ID }, deps);

    expect(result.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('responds 400 for a non-object body', async () => {
    const { deps } = makeDeps();

    expect((await reportError({ body: null, headerTraceId: TRACE_ID }, deps)).status).toBe(400);
  });

  it('responds 400 when the body trace id differs from the header', async () => {
    const { deps, insert } = makeDeps();

    const result = await reportError({ body: VALID_BODY, headerTraceId: 'other-trace-id-123' }, deps);

    expect(result.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});

// Happy path - redacted web row linked to the operator and organization.
describe('reportError - stored report', () => {
  it('responds 201 and stores a redacted web error', async () => {
    const { deps, insert } = makeDeps();

    const result = await reportError({ body: VALID_BODY, headerTraceId: TRACE_ID }, deps);

    expect(result).toEqual({ status: 201, body: { code: 'F3B1C2D4' } });
    const row = insert.mock.calls[0]?.[0];
    expect(row).toMatchObject({ source: 'web', level: 'error', traceId: TRACE_ID, orgId: PROFILE.orgId, userId: PROFILE.id });
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('30123456');
    expect(serialized).not.toContain('2945123456');
    expect(serialized).not.toContain('token=abc');
    expect(row?.details).toMatchObject({ url: VALID_BODY.url, digest: '12345' });
  });

  it('responds 500 when the row could not be stored', async () => {
    const { deps } = makeDeps({ log: async () => null });

    const result = await reportError({ body: VALID_BODY, headerTraceId: TRACE_ID }, deps);

    expect(result.status).toBe(500);
  });
});
