import { visibleNavItems } from './nav-items';

const hrefs = (role: Parameters<typeof visibleNavItems>[0]) => visibleNavItems(role).map((item) => item.href);

// Role filtering - Áreas/Operadores admin-only; Soporte for admin and support.
describe('visibleNavItems', () => {
  it('hides admin settings and Soporte from operators', () => {
    expect(hrefs('operator')).toEqual(['/inbox', '/citizens', '/tasks', '/settings/profile']);
  });

  it('hides Áreas, Operadores and Soporte from area leads', () => {
    expect(hrefs('area_lead')).not.toContain('/support/errors');
    expect(hrefs('area_lead')).not.toContain('/settings/areas');
    expect(hrefs('area_lead')).not.toContain('/settings/operators');
  });

  it('shows Áreas, Operadores and Líneas only to admin', () => {
    expect(hrefs('admin')).toEqual([
      '/inbox',
      '/citizens',
      '/tasks',
      '/settings/profile',
      '/settings/areas',
      '/settings/operators',
      '/settings/lines',
      '/settings/quick-replies',
      '/settings/hours',
      '/support/errors',
    ]);
  });

  it('shows Soporte to support without Áreas/Operadores/Líneas', () => {
    expect(hrefs('support')).toEqual(['/inbox', '/citizens', '/tasks', '/settings/profile', '/support/errors']);
  });
});
