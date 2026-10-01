import type { Profile } from '@epuyen/shared';
import { loginUrl } from './login-url';

// Guard ports - session lookup, profile lookup (admin client, sees inactive rows), sign-out, redirect.
export type OperatorGuardDeps = {
  currentPath: string | null;
  getSessionUserId: () => Promise<string | null>;
  findProfile: (userId: string) => Promise<Profile | null>;
  signOut: () => Promise<void>;
  redirect: (url: string) => never;
};

// Operator guard - returns the active profile or redirects (anonymous, orphan or inactive user).
export async function requireOperator(deps: OperatorGuardDeps): Promise<Profile> {
  const userId = await deps.getSessionUserId();
  if (!userId) return deps.redirect(loginUrl({ next: deps.currentPath ?? undefined }));

  const profile = await deps.findProfile(userId);
  if (!profile) {
    await deps.signOut();
    return deps.redirect(loginUrl({ reason: 'no_profile' }));
  }
  if (!profile.isActive) {
    await deps.signOut();
    return deps.redirect(loginUrl({ reason: 'inactive' }));
  }

  return profile;
}
