import type { Profile, Role } from '@epuyen/shared';

// Role guard port - interrupt that renders the 403 page and never returns.
export type RoleGuardDeps = { forbidden: () => never };

// Role guard - returns the profile when its role is in the page's allow-list.
export function requireRole(profile: Profile, allowed: readonly Role[], deps: RoleGuardDeps): Profile {
  if (!allowed.includes(profile.role)) return deps.forbidden();
  return profile;
}
