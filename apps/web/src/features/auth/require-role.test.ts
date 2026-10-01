import type { Profile } from '@epuyen/shared';
import { requireRole } from './require-role';

const PROFILE: Profile = {
  id: '00000000-0000-4000-8000-0000000000a1',
  orgId: 'aaaaaaaa-0000-4000-8000-000000000001',
  fullName: 'Ana Pérez',
  avatarPath: null,
  role: 'operator',
  isActive: true,
};

// Forbidden signal - stands in for Next's forbidden(), which never returns.
class ForbiddenSignal extends Error {}

function makeDeps() {
  return {
    forbidden: vi.fn((): never => {
      throw new ForbiddenSignal('forbidden');
    }),
  };
}

// Role check - pass-through when allowed, forbidden interrupt otherwise.
describe('requireRole', () => {
  it('returns the profile when its role is allowed', () => {
    const deps = makeDeps();
    const support = { ...PROFILE, role: 'support' as const };

    expect(requireRole(support, ['admin', 'support'], deps)).toBe(support);
    expect(deps.forbidden).not.toHaveBeenCalled();
  });

  it('interrupts with forbidden when the role is not allowed', () => {
    const deps = makeDeps();

    expect(() => requireRole(PROFILE, ['admin', 'support'], deps)).toThrow(ForbiddenSignal);
    expect(deps.forbidden).toHaveBeenCalledTimes(1);
  });
});
