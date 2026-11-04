import { loginSchema, type LoginField, type LoginInput } from '@/contracts/auth';
import { esAR } from '@/i18n/es-AR';

// Sign-in port - password sign-in that resolves true only when a session was created.
export type SignInDeps = {
  signInWithPassword: (credentials: LoginInput) => Promise<boolean>;
};

// Sign-in outcome - ok, field-level validation errors, or a generic non-enumerating failure.
export type SignInResult =
  | { status: 'ok' }
  | { status: 'invalid'; fieldErrors: Partial<Record<LoginField, string>> }
  | { status: 'failed'; message: string };

// Sign-in use case - validates raw form input, then delegates to the auth port.
export async function signIn(input: unknown, deps: SignInDeps): Promise<SignInResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    return {
      status: 'invalid',
      fieldErrors: {
        ...(fieldErrors.email?.[0] && { email: fieldErrors.email[0] }),
        ...(fieldErrors.password?.[0] && { password: fieldErrors.password[0] }),
      },
    };
  }

  const ok = await deps.signInWithPassword(parsed.data);
  return ok ? { status: 'ok' } : { status: 'failed', message: esAR.auth.errors.invalidCredentials };
}
