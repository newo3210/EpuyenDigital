import { resolveRouteAccess } from './route-access';

const USER_ID = '00000000-0000-4000-8000-0000000000a1';

// Public routes - login and API handlers are never redirected by the middleware.
describe('resolveRouteAccess - public paths', () => {
  it.each(['/login', '/api/errors/report'])('allows anonymous access to %s', (pathname) => {
    expect(resolveRouteAccess({ pathname, search: '', userId: null })).toEqual({ type: 'allow' });
  });

  it('does not treat look-alike paths as public', () => {
    expect(resolveRouteAccess({ pathname: '/loginx', search: '', userId: null })).toEqual({
      type: 'redirect',
      location: '/login?next=/loginx',
    });
  });
});

// Panel routes - anonymous visitors go to login preserving path and query; signed-in users pass.
describe('resolveRouteAccess - panel paths', () => {
  it('redirects anonymous /inbox to login with next', () => {
    expect(resolveRouteAccess({ pathname: '/inbox', search: '', userId: null })).toEqual({
      type: 'redirect',
      location: '/login?next=/inbox',
    });
  });

  it('keeps the query string inside next', () => {
    expect(resolveRouteAccess({ pathname: '/support/errors', search: '?status=open', userId: null })).toEqual({
      type: 'redirect',
      location: '/login?next=/support/errors%3Fstatus%3Dopen',
    });
  });

  it('allows a signed-in user', () => {
    expect(resolveRouteAccess({ pathname: '/inbox', search: '', userId: USER_ID })).toEqual({ type: 'allow' });
  });
});
