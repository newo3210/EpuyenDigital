// @vitest-environment node
import { digestRef } from './digest-ref';
import { toRequestErrorLog, type RequestErrorContext, type RequestErrorInfo } from './request-error';

const TRACE_ID = 'f3b1c2d4-0000-4000-8000-000000000001';

const REQUEST: RequestErrorInfo = {
  path: '/inbox?tab=open',
  method: 'GET',
  headers: { 'x-trace-id': TRACE_ID },
};

const RENDER: RequestErrorContext = { routerKind: 'App Router', routePath: '/(panel)/inbox', routeType: 'render' };

// Error with digest - mimics what Next attaches to server render errors.
function withDigest(message: string, digest: string): Error {
  return Object.assign(new Error(message), { digest });
}

// Mapping - unhandled server errors become web/api log inputs keyed by the request trace id.
describe('toRequestErrorLog', () => {
  it('maps a render error to a web log with the request trace id', () => {
    const log = toRequestErrorLog(withDigest('boom', '123'), REQUEST, RENDER);

    expect(log).toMatchObject({ source: 'web', level: 'error', message: 'boom', traceId: TRACE_ID });
    expect(log?.details).toMatchObject({ path: '/inbox?tab=open', method: 'GET', routeType: 'render' });
  });

  it('stores a digest reference that matches the client report instead of the raw digest', () => {
    const log = toRequestErrorLog(withDigest('boom', '2945123456'), REQUEST, RENDER);

    expect(log?.details).toMatchObject({ digestRef: digestRef('2945123456') });
    expect(log?.details).not.toHaveProperty('digest');
  });

  it('uses source api for route handlers', () => {
    const log = toRequestErrorLog(new Error('db down'), REQUEST, { ...RENDER, routeType: 'route' });

    expect(log?.source).toBe('api');
  });

  it('generates a trace id when the header is missing or unsafe', () => {
    const missing = toRequestErrorLog(new Error('boom'), { ...REQUEST, headers: {} }, RENDER);
    const unsafe = toRequestErrorLog(new Error('boom'), { ...REQUEST, headers: { 'x-trace-id': '<script>' } }, RENDER);

    expect(missing?.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(unsafe?.traceId).not.toBe('<script>');
  });

  it('takes the first value of a repeated trace header', () => {
    const log = toRequestErrorLog(new Error('boom'), { ...REQUEST, headers: { 'x-trace-id': [TRACE_ID, 'other-id-123'] } }, RENDER);

    expect(log?.traceId).toBe(TRACE_ID);
  });

  it('stringifies non-Error throws', () => {
    expect(toRequestErrorLog('plain failure', REQUEST, RENDER)?.message).toBe('plain failure');
  });

  it('ignores Next control-flow errors (redirect, not found, forbidden)', () => {
    expect(toRequestErrorLog(withDigest('NEXT_REDIRECT', 'NEXT_REDIRECT;replace;/login;307;'), REQUEST, RENDER)).toBeNull();
    expect(toRequestErrorLog(withDigest('NEXT_HTTP_ERROR_FALLBACK;403', 'NEXT_HTTP_ERROR_FALLBACK;403'), REQUEST, RENDER)).toBeNull();
  });
});
