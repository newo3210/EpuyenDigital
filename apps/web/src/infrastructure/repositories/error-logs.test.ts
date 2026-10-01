import { describe, expect, it } from 'vitest';
import { createSupabaseMock } from '@/test/supabase-mock';
import { changeErrorLogStatus, findErrorLogById, insertErrorLog, listErrorLogs } from './error-logs';

// Fixtures - a stored error row (snake_case) and its domain mapping (camelCase).
const ORG_ID = '7d3c1f9e-2b4a-4c8d-9e1f-0a2b3c4d5e6f';
const USER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const ERROR_ID = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
const COLUMNS =
  'id, org_id, source, level, message, details, trace_id, user_id, status, resolved_by, resolved_at, created_at';

const row = {
  id: ERROR_ID,
  org_id: ORG_ID,
  source: 'web',
  level: 'error',
  message: 'Render failed',
  details: { url: '/inbox' },
  trace_id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: USER_ID,
  status: 'open',
  resolved_by: null,
  resolved_at: null,
  created_at: '2026-10-01T12:00:00.123456+00:00',
};

const domain = {
  id: ERROR_ID,
  orgId: ORG_ID,
  source: 'web',
  level: 'error',
  message: 'Render failed',
  details: { url: '/inbox' },
  traceId: '550e8400-e29b-41d4-a716-446655440000',
  userId: USER_ID,
  status: 'open',
  resolvedBy: null,
  resolvedAt: null,
  createdAt: '2026-10-01T12:00:00.123456+00:00',
};

// Insert - admin client writes an already-redacted incident.
describe('insertErrorLog', () => {
  it('inserts the snake_case row and returns the new id', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: { id: ERROR_ID }, error: null });

    const id = await insertErrorLog(mock.client, {
      orgId: ORG_ID,
      source: 'web',
      level: 'error',
      message: 'Render failed',
      details: { url: '/inbox' },
      traceId: row.trace_id,
      userId: USER_ID,
    });

    expect(id).toBe(ERROR_ID);
    expect(mock.callsFor('error_logs')).toEqual([
      {
        method: 'insert',
        args: [
          {
            org_id: ORG_ID,
            source: 'web',
            level: 'error',
            message: 'Render failed',
            details: { url: '/inbox' },
            trace_id: row.trace_id,
            user_id: USER_ID,
          },
        ],
      },
      { method: 'select', args: ['id'] },
      { method: 'single', args: [] },
    ]);
  });

  it('throws error_logs.write_failed when the insert errors', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: null, error: { message: 'denied' } });
    await expect(
      insertErrorLog(mock.client, {
        orgId: null,
        source: 'api',
        level: 'warn',
        message: 'x',
        details: {},
        traceId: 'trace-0001',
        userId: null,
      }),
    ).rejects.toMatchObject({ code: 'error_logs.write_failed' });
  });
});

// List - newest first, optional filters, bounded page size.
describe('listErrorLogs', () => {
  it('lists newest first with the default limit and maps rows', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: [row], error: null });

    await expect(listErrorLogs(mock.client, {})).resolves.toEqual([domain]);
    expect(mock.callsFor('error_logs')).toEqual([
      { method: 'select', args: [COLUMNS] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [50] },
    ]);
  });

  it('applies status, source, level and date range filters', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: [], error: null });

    await listErrorLogs(mock.client, {
      status: 'open',
      source: 'web',
      level: 'error',
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-30T23:59:59Z',
      limit: 10,
    });

    expect(mock.callsFor('error_logs')).toEqual([
      { method: 'select', args: [COLUMNS] },
      { method: 'eq', args: ['status', 'open'] },
      { method: 'eq', args: ['source', 'web'] },
      { method: 'eq', args: ['level', 'error'] },
      { method: 'gte', args: ['created_at', '2026-09-01T00:00:00Z'] },
      { method: 'lte', args: ['created_at', '2026-09-30T23:59:59Z'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [10] },
    ]);
  });

  it('caps the page size at 200', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: [], error: null });
    await listErrorLogs(mock.client, { limit: 5000 });
    expect(mock.callsFor('error_logs').at(-1)).toEqual({ method: 'limit', args: [200] });
  });

  it('throws error_logs.read_failed when the query errors', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: null, error: { message: 'boom' } });
    await expect(listErrorLogs(mock.client, {})).rejects.toMatchObject({ code: 'error_logs.read_failed' });
  });
});

// Find by id - detail panel row, null when missing or hidden by RLS.
describe('findErrorLogById', () => {
  it('returns the mapped row', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: row, error: null });

    await expect(findErrorLogById(mock.client, ERROR_ID)).resolves.toEqual(domain);
    expect(mock.callsFor('error_logs')).toEqual([
      { method: 'select', args: [COLUMNS] },
      { method: 'eq', args: ['id', ERROR_ID] },
      { method: 'maybeSingle', args: [] },
    ]);
  });

  it('returns null when the row is not visible', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: null, error: null });
    await expect(findErrorLogById(mock.client, ERROR_ID)).resolves.toBeNull();
  });

  it('throws error_logs.read_failed when the query errors', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: null, error: { message: 'boom' } });
    await expect(findErrorLogById(mock.client, ERROR_ID)).rejects.toMatchObject({ code: 'error_logs.read_failed' });
  });
});

// Status change - only status is sent; the database stamps resolution fields.
describe('changeErrorLogStatus', () => {
  it('updates only status and returns the mapped row', async () => {
    const mock = createSupabaseMock();
    const resolvedRow = { ...row, status: 'resolved', resolved_by: USER_ID, resolved_at: '2026-10-01T13:00:00+00:00' };
    mock.queue('error_logs', { data: resolvedRow, error: null });

    await expect(changeErrorLogStatus(mock.client, ERROR_ID, 'resolved')).resolves.toEqual({
      ...domain,
      status: 'resolved',
      resolvedBy: USER_ID,
      resolvedAt: '2026-10-01T13:00:00+00:00',
    });
    expect(mock.callsFor('error_logs')).toEqual([
      { method: 'update', args: [{ status: 'resolved' }] },
      { method: 'eq', args: ['id', ERROR_ID] },
      { method: 'select', args: [COLUMNS] },
      { method: 'maybeSingle', args: [] },
    ]);
  });

  it('throws error_logs.not_found when RLS hides the row', async () => {
    const mock = createSupabaseMock();
    mock.queue('error_logs', { data: null, error: null });
    await expect(changeErrorLogStatus(mock.client, ERROR_ID, 'acknowledged')).rejects.toMatchObject({
      code: 'error_logs.not_found',
    });
  });
});
