import { signOut, type SignOutDeps } from './sign-out';

// Redirect signal - stands in for Next's redirect(), which never returns.
class RedirectSignal extends Error {}

// Sign-out use case - clears the session first, then always lands on /login.
describe('signOut', () => {
  it('signs out and redirects to login', async () => {
    const events: string[] = [];
    const deps: SignOutDeps = {
      signOut: async () => {
        events.push('signOut');
      },
      redirect: (url) => {
        events.push(`redirect:${url}`);
        throw new RedirectSignal(url);
      },
    };

    await expect(signOut(deps)).rejects.toBeInstanceOf(RedirectSignal);
    expect(events).toEqual(['signOut', 'redirect:/login']);
  });

  it('still redirects when the sign-out call fails', async () => {
    const redirect = vi.fn((url: string): never => {
      throw new RedirectSignal(url);
    });
    const deps: SignOutDeps = {
      signOut: async () => {
        throw new Error('network down');
      },
      redirect,
    };

    await expect(signOut(deps)).rejects.toBeInstanceOf(RedirectSignal);
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
