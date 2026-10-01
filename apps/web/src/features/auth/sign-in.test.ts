import { esAR } from '@/i18n/es-AR';
import { signIn, type SignInDeps } from './sign-in';

// Test deps - password sign-in port that succeeds unless told otherwise.
function makeDeps(succeeds = true) {
  const signInWithPassword = vi.fn<SignInDeps['signInWithPassword']>(async () => succeeds);
  return { signInWithPassword };
}

// Valid credentials - normalized email reaches the auth port and the result is ok.
describe('signIn - valid input', () => {
  it('signs in with trimmed, lower-cased email', async () => {
    const deps = makeDeps();

    const result = await signIn({ email: '  Ana@Epuyen.gob.ar ', password: 'secret-123' }, deps);

    expect(result).toEqual({ status: 'ok' });
    expect(deps.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@epuyen.gob.ar', password: 'secret-123' });
  });

  it('returns the generic message when Supabase rejects the credentials', async () => {
    const deps = makeDeps(false);

    const result = await signIn({ email: 'ana@epuyen.gob.ar', password: 'wrong' }, deps);

    expect(result).toEqual({ status: 'failed', message: esAR.auth.errors.invalidCredentials });
  });
});

// Invalid input - field errors are returned and the auth port is never called.
describe('signIn - invalid input', () => {
  it('flags a malformed email', async () => {
    const deps = makeDeps();

    const result = await signIn({ email: 'not-an-email', password: 'secret-123' }, deps);

    expect(result).toEqual({ status: 'invalid', fieldErrors: { email: esAR.auth.errors.invalidEmail } });
    expect(deps.signInWithPassword).not.toHaveBeenCalled();
  });

  it('flags an empty password', async () => {
    const deps = makeDeps();

    const result = await signIn({ email: 'ana@epuyen.gob.ar', password: '' }, deps);

    expect(result).toEqual({ status: 'invalid', fieldErrors: { password: esAR.auth.errors.passwordRequired } });
    expect(deps.signInWithPassword).not.toHaveBeenCalled();
  });

  it('flags both fields when the payload is missing', async () => {
    const deps = makeDeps();

    const result = await signIn({}, deps);

    expect(result).toEqual({
      status: 'invalid',
      fieldErrors: { email: esAR.auth.errors.invalidEmail, password: esAR.auth.errors.passwordRequired },
    });
    expect(deps.signInWithPassword).not.toHaveBeenCalled();
  });
});
