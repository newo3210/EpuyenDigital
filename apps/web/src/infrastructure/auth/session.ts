import type { DbClient } from '@/infrastructure/repositories/errors';

// Credentials - already validated email and password.
export type PasswordCredentials = { email: string; password: string };

// Password sign-in - writes session cookies through the client; true only on success.
export async function passwordSignIn(client: DbClient, credentials: PasswordCredentials): Promise<boolean> {
  const { error } = await client.auth.signInWithPassword(credentials);
  return !error;
}

// Session user - id verified against Supabase Auth (getUser), never trusted from cookies alone.
export async function getSessionUserId(client: DbClient): Promise<string | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

// Sign-out - clears this device's session cookies; other devices stay signed in.
export async function signOutSession(client: DbClient): Promise<void> {
  await client.auth.signOut({ scope: 'local' });
}
