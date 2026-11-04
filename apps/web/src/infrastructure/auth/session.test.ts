import { createSupabaseMock } from '@/test/supabase-mock';
import { getSessionUserId, passwordSignIn, signOutSession } from './session';

const USER = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ana@epuyen.gob.ar' };
const CREDENTIALS = { email: 'ana@epuyen.gob.ar', password: 'secret-123' };

// Password sign-in - true only when Supabase returns no error.
describe('passwordSignIn', () => {
  it('returns true and forwards the credentials on success', async () => {
    const mock = createSupabaseMock();
    mock.setUser(USER);

    await expect(passwordSignIn(mock.client, CREDENTIALS)).resolves.toBe(true);
    expect(mock.authCalls).toEqual([{ method: 'signInWithPassword', args: [CREDENTIALS] }]);
  });

  it('returns false when Supabase rejects the credentials', async () => {
    const mock = createSupabaseMock();
    mock.setAuthError({ message: 'Invalid login credentials' });

    await expect(passwordSignIn(mock.client, CREDENTIALS)).resolves.toBe(false);
  });
});

// Session user - verified user id from auth.getUser(), null when anonymous or invalid.
describe('getSessionUserId', () => {
  it('returns the verified user id', async () => {
    const mock = createSupabaseMock();
    mock.setUser(USER);

    await expect(getSessionUserId(mock.client)).resolves.toBe(USER.id);
  });

  it('returns null without a session', async () => {
    const mock = createSupabaseMock();

    await expect(getSessionUserId(mock.client)).resolves.toBeNull();
  });

  it('returns null when the token cannot be verified', async () => {
    const mock = createSupabaseMock();
    mock.setUser(USER);
    mock.setAuthError({ message: 'invalid JWT' });

    await expect(getSessionUserId(mock.client)).resolves.toBeNull();
  });
});

// Sign-out - clears only this device's session.
describe('signOutSession', () => {
  it('signs out with local scope', async () => {
    const mock = createSupabaseMock();

    await signOutSession(mock.client);

    expect(mock.authCalls).toEqual([{ method: 'signOut', args: [{ scope: 'local' }] }]);
  });
});
