import type { NewErrorLog } from '@/infrastructure/repositories/error-logs';
import { MAX_MESSAGE_CHARS, logError, type LogErrorDeps } from './log-error';

const TRACE_ID = 'f3b1c2d4-0000-4000-8000-000000000001';
const ORG_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-0000000000a1';

// Test deps - insert port returning a fixed id (or failing) and a fallback spy.
function makeDeps(fails = false) {
  const insert = vi.fn<LogErrorDeps['insert']>(async () => {
    if (fails) throw new Error('error_logs.write_failed');
    return 'log-id-1';
  });
  const fallback = vi.fn<LogErrorDeps['fallback']>();
  return { insert, fallback };
}

const insertedRow = (deps: ReturnType<typeof makeDeps>): NewErrorLog => {
  const row = deps.insert.mock.calls[0]?.[0];
  if (!row) throw new Error('insert was not called');
  return row;
};

// Redaction - personal data and secrets never reach the database.
describe('logError - redaction', () => {
  it('masks DNI, phone and token in the message', async () => {
    const deps = makeDeps();

    await logError({ source: 'api', message: 'DNI 30123456, tel 2945123456, token=abc', traceId: TRACE_ID }, deps);

    const { message } = insertedRow(deps);
    expect(message).not.toContain('30123456');
    expect(message).not.toContain('2945123456');
    expect(message).not.toContain('abc');
  });

  it('masks nested personal data in details', async () => {
    const deps = makeDeps();

    await logError(
      {
        source: 'web',
        message: 'boom',
        traceId: TRACE_ID,
        details: { request: { email: 'vecino@gmail.com', note: 'llamar al 2945 123456' }, apiKey: 'sk-live' },
      },
      deps,
    );

    const serialized = JSON.stringify(insertedRow(deps).details);
    expect(serialized).not.toContain('vecino@gmail.com');
    expect(serialized).not.toContain('2945 123456');
    expect(serialized).not.toContain('sk-live');
  });
});

// Row shape - defaults and passthrough fields.
describe('logError - row', () => {
  it('fills defaults and returns the new id', async () => {
    const deps = makeDeps();

    const id = await logError({ source: 'api', message: 'boom', traceId: TRACE_ID }, deps);

    expect(id).toBe('log-id-1');
    expect(insertedRow(deps)).toEqual({
      source: 'api',
      level: 'error',
      message: 'boom',
      details: {},
      traceId: TRACE_ID,
      orgId: null,
      userId: null,
    });
  });

  it('keeps org, user and level when given', async () => {
    const deps = makeDeps();

    await logError(
      { source: 'web', level: 'warn', message: 'boom', traceId: TRACE_ID, orgId: ORG_ID, userId: USER_ID },
      deps,
    );

    expect(insertedRow(deps)).toMatchObject({ level: 'warn', orgId: ORG_ID, userId: USER_ID });
  });

  it('truncates very long messages', async () => {
    const deps = makeDeps();

    await logError({ source: 'api', message: 'x'.repeat(MAX_MESSAGE_CHARS + 500), traceId: TRACE_ID }, deps);

    expect(insertedRow(deps).message).toHaveLength(MAX_MESSAGE_CHARS);
  });

  it('logs a 200 KB adversarial message and stack within 200 ms', async () => {
    const deps = makeDeps();
    const huge = 'a.'.repeat(100_000);

    const start = performance.now();
    await logError({ source: 'web', message: huge, details: { stack: huge }, traceId: TRACE_ID }, deps);

    expect(performance.now() - start).toBeLessThan(200);
    expect(insertedRow(deps).message.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
  });

  it('still masks personal data near the truncation boundary', async () => {
    const deps = makeDeps();

    await logError(
      { source: 'api', message: `${'x'.repeat(MAX_MESSAGE_CHARS - 12)} 30123456 tail`, traceId: TRACE_ID },
      deps,
    );

    expect(insertedRow(deps).message).not.toContain('3012');
  });
});

// Failure handling - logging must never break the caller.
describe('logError - insert failure', () => {
  it('returns null and falls back to the console with redacted data', async () => {
    const deps = makeDeps(true);

    const id = await logError({ source: 'api', message: 'DNI 30123456 failed', traceId: TRACE_ID }, deps);

    expect(id).toBeNull();
    expect(deps.fallback).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(deps.fallback.mock.calls[0])).not.toContain('30123456');
  });

  it('never throws even if the fallback throws', async () => {
    const deps = makeDeps(true);
    deps.fallback.mockImplementation(() => {
      throw new Error('console unavailable');
    });

    await expect(logError({ source: 'api', message: 'boom', traceId: TRACE_ID }, deps)).resolves.toBeNull();
  });
});
