import { loginUrl } from './login-url';

// Login URL builder - optional next path and lockout reason as readable query params.
describe('loginUrl', () => {
  it('returns the bare login path without params', () => {
    expect(loginUrl()).toBe('/login');
  });

  it('keeps slashes readable in next', () => {
    expect(loginUrl({ next: '/support/errors' })).toBe('/login?next=/support/errors');
  });

  it('encodes query characters inside next', () => {
    expect(loginUrl({ next: '/inbox?tab=open&page=2' })).toBe('/login?next=/inbox%3Ftab%3Dopen%26page%3D2');
  });

  it('adds the lockout reason', () => {
    expect(loginUrl({ reason: 'inactive' })).toBe('/login?reason=inactive');
  });

  it('drops an unsafe next', () => {
    expect(loginUrl({ next: '//evil.com' })).toBe('/login');
  });
});
