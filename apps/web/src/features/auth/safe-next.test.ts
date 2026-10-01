import { DEFAULT_NEXT, safeNext } from './safe-next';

// Accepted targets - same-origin relative paths are returned unchanged.
describe('safeNext - relative paths', () => {
  it.each(['/inbox', '/support/errors', '/settings/profile?tab=avatar', '/tasks#top'])('keeps %s', (path) => {
    expect(safeNext(path)).toBe(path);
  });
});

// Rejected targets - empty, absolute, protocol-relative or browser-normalized external URLs.
describe('safeNext - unsafe or missing values', () => {
  it.each([
    [undefined],
    [null],
    [''],
    ['   '],
    ['inbox'],
    ['//evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['/inbox\nSet-Cookie: x=1'],
    ['/login'],
    ['/login?next=/inbox'],
  ])('falls back to /inbox for %j', (value) => {
    expect(safeNext(value)).toBe(DEFAULT_NEXT);
  });

  it('uses /inbox as the default target', () => {
    expect(DEFAULT_NEXT).toBe('/inbox');
  });
});
