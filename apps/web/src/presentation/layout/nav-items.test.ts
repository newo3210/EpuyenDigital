import { visibleNavItems } from './nav-items';

const hrefs = (role: Parameters<typeof visibleNavItems>[0]) => visibleNavItems(role).map((item) => item.href);

// Role filtering - Áreas/Operadores admin-only; Soporte for admin+support.
describe('visibleNavItems', () => {
  it('hides admin settings and Soporte from operators', () => {
    expect(hrefs('operator')).toEqual(['/inbox', '/citizens', '/tasks', '/settings/profile']);
  });

  it('hides Áreas, Operadores and Soporte from area leads', () => {
    expect(hrefs('area_lead')).toEqual(['/inbox', '/citizens', '/tasks', '/settings/profile']);
  });

  it('shows Áreas, Operadores and Soporte to admin', () => {
    expect(hrefs('admin')).toEqual([
      '/inbox',
      '/citizens',
      '/tasks',
      '/settings/profile',
      '/settings/areas',
      '/settings/operators',
      '/support/errors',
    ]);
  });

  it('shows Soporte but not Áreas/Operadores to support', () => {
    expect(hrefs('support')).toEqual([
      '/inbox',
      '/citizens',
      '/tasks',
      '/settings/profile',
      '/support/errors',
    ]);
  });
});
