import { visibleNavItems } from './nav-items';

const hrefs = (role: Parameters<typeof visibleNavItems>[0]) => visibleNavItems(role).map((item) => item.href);

// Role filtering - support section only for admin and support; everything else for all roles.
describe('visibleNavItems', () => {
  it('hides Soporte from operators', () => {
    expect(hrefs('operator')).toEqual(['/inbox', '/citizens', '/tasks', '/settings/profile']);
  });

  it('hides Soporte from area leads', () => {
    expect(hrefs('area_lead')).not.toContain('/support/errors');
  });

  it.each(['admin', 'support'] as const)('shows Soporte to %s', (role) => {
    expect(hrefs(role)).toEqual(['/inbox', '/citizens', '/tasks', '/settings/profile', '/support/errors']);
  });
});
