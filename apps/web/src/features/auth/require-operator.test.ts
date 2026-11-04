import type { Profile } from '@epuyen/shared';
import { requireOperator, type OperatorGuardDeps } from './require-operator';

const USER_ID = '00000000-0000-4000-8000-0000000000a1';

const ACTIVE_PROFILE: Profile = {
  id: USER_ID,
  orgId: 'aaaaaaaa-0000-4000-8000-000000000001',
  fullName: 'Ana Pérez',
  avatarPath: null,
  role: 'operator',
  isActive: true,
};

// Redirect signal - stands in for Next's redirect(), which never returns.
class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

// Test deps - configurable session user and profile; every port is a spy.
function makeDeps(overrides: { userId?: string | null; profile?: Profile | null; currentPath?: string | null } = {}) {
  const events: string[] = [];
  const deps = {
    currentPath: overrides.currentPath === undefined ? '/inbox' : overrides.currentPath,
    getSessionUserId: vi.fn(async () => (overrides.userId === undefined ? USER_ID : overrides.userId)),
    findProfile: vi.fn(async () => (overrides.profile === undefined ? ACTIVE_PROFILE : overrides.profile)),
    signOut: vi.fn(async () => {
      events.push('signOut');
    }),
    redirect: vi.fn((url: string): never => {
      events.push(`redirect:${url}`);
      throw new RedirectSignal(url);
    }),
  } satisfies OperatorGuardDeps;
  return { deps, events };
}

// Anonymous visitor - sent to login with the requested path preserved.
describe('requireOperator - no session', () => {
  it('redirects to login with next', async () => {
    const { deps, events } = makeDeps({ userId: null, currentPath: '/support/errors' });

    await expect(requireOperator(deps)).rejects.toBeInstanceOf(RedirectSignal);
    expect(events).toEqual(['redirect:/login?next=/support/errors']);
    expect(deps.findProfile).not.toHaveBeenCalled();
  });

  it('redirects to bare login when the path is unknown', async () => {
    const { deps, events } = makeDeps({ userId: null, currentPath: null });

    await expect(requireOperator(deps)).rejects.toBeInstanceOf(RedirectSignal);
    expect(events).toEqual(['redirect:/login']);
  });
});

// Locked-out accounts - signed out first, then sent to login with the reason.
describe('requireOperator - locked out', () => {
  it('signs out a user without profile', async () => {
    const { deps, events } = makeDeps({ profile: null });

    await expect(requireOperator(deps)).rejects.toBeInstanceOf(RedirectSignal);
    expect(deps.findProfile).toHaveBeenCalledWith(USER_ID);
    expect(events).toEqual(['signOut', 'redirect:/login?reason=no_profile']);
  });

  it('signs out an inactive user', async () => {
    const { deps, events } = makeDeps({ profile: { ...ACTIVE_PROFILE, isActive: false } });

    await expect(requireOperator(deps)).rejects.toBeInstanceOf(RedirectSignal);
    expect(events).toEqual(['signOut', 'redirect:/login?reason=inactive']);
  });
});

// Active operator - profile returned, no side effects.
describe('requireOperator - active', () => {
  it('returns the profile', async () => {
    const { deps, events } = makeDeps();

    await expect(requireOperator(deps)).resolves.toEqual(ACTIVE_PROFILE);
    expect(events).toEqual([]);
  });
});
