import { loginUrl } from './login-url';

// Sign-out ports - session termination and Next redirect (never returns).
export type SignOutDeps = {
  signOut: () => Promise<void>;
  redirect: (url: string) => never;
};

// Sign-out use case - best-effort session clear; the user always lands on /login.
export async function signOut(deps: SignOutDeps): Promise<never> {
  try {
    await deps.signOut();
  } catch {
    // Middleware drops a stale session on the next request; login must stay reachable.
  }
  return deps.redirect(loginUrl());
}
