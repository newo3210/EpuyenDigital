'use server';

import { redirect } from 'next/navigation';
import type { LoginField } from '@/contracts/auth';
import { passwordSignIn, signOutSession } from '@/infrastructure/auth/session';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { safeNext } from './safe-next';
import { signIn } from './sign-in';
import { signOut } from './sign-out';

// Login form state - field errors or generic message returned to the form (useActionState).
export type LoginFormState = {
  fieldErrors?: Partial<Record<LoginField, string>>;
  message?: string;
};

const formText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
};

// Sign-in action - validates, signs in (cookies set server-side), then redirects to a safe next.
export async function signInAction(_previous: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const supabase = await createServerSupabase();
  const result = await signIn(
    { email: formText(formData, 'email'), password: formText(formData, 'password') },
    { signInWithPassword: (credentials) => passwordSignIn(supabase, credentials) },
  );

  if (result.status === 'invalid') return { fieldErrors: result.fieldErrors };
  if (result.status === 'failed') return { message: result.message };
  redirect(safeNext(formText(formData, 'next')));
}

// Sign-out action - clears the session and returns to /login.
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await signOut({ signOut: () => signOutSession(supabase), redirect });
}
