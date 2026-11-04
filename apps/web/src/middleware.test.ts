// @vitest-environment node
import { NextRequest, NextResponse } from 'next/server';

// Session refresh mock - captures forwarded request headers and returns a configurable user.
const { updateSession, session } = vi.hoisted(() => {
  const session = { userId: null as string | null, forwarded: null as Headers | null };
  const updateSession = vi.fn(async (_request: unknown, requestHeaders: Headers) => {
    session.forwarded = requestHeaders;
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.set('sb-test-auth-token', 'refreshed');
    return { response, userId: session.userId };
  });
  return { updateSession, session };
});
vi.mock('@/infrastructure/supabase/middleware', () => ({ updateSession }));

import { middleware } from './middleware';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TRACE_ID = 'f3b1c2d4-0000-4000-8000-000000000001';

beforeEach(() => {
  session.userId = null;
  session.forwarded = null;
  updateSession.mockClear();
});

// Trace id - generated when absent, reused when safe, always echoed in the response.
describe('middleware - trace id', () => {
  it('generates a trace id and returns it in the response header', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/login'));

    const traceId = response.headers.get('x-trace-id');
    expect(traceId).toMatch(UUID_RE);
    expect(session.forwarded?.get('x-trace-id')).toBe(traceId);
  });

  it('keeps a safe incoming trace id', async () => {
    const request = new NextRequest('http://localhost:3000/login', { headers: { 'x-trace-id': TRACE_ID } });

    const response = await middleware(request);

    expect(response.headers.get('x-trace-id')).toBe(TRACE_ID);
  });

  it('replaces an unsafe incoming trace id', async () => {
    const request = new NextRequest('http://localhost:3000/login', { headers: { 'x-trace-id': 'bad id <script>' } });

    const response = await middleware(request);

    expect(response.headers.get('x-trace-id')).toMatch(UUID_RE);
  });

  it('forwards the current path and query to server components', async () => {
    session.userId = 'user-1';

    await middleware(new NextRequest('http://localhost:3000/support/errors?status=open'));

    expect(session.forwarded?.get('x-pathname')).toBe('/support/errors?status=open');
  });
});

// Route protection - anonymous panel requests redirect to login keeping cookies and trace id.
describe('middleware - anonymous access', () => {
  it('redirects an anonymous panel request to login with next', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/inbox'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?next=/inbox');
    expect(response.headers.get('x-trace-id')).toMatch(UUID_RE);
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed');
  });

  it('lets an authenticated panel request through', async () => {
    session.userId = 'user-1';

    const response = await middleware(new NextRequest('http://localhost:3000/inbox'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('does not redirect public paths', async () => {
    const response = await middleware(new NextRequest('http://localhost:3000/api/errors/report', { method: 'POST' }));

    expect(response.headers.get('location')).toBeNull();
  });
});
