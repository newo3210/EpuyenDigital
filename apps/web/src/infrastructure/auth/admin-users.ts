import 'server-only';
import type { AdminSupabase } from '@/infrastructure/supabase/admin';
import { RepositoryError } from '@/infrastructure/repositories/errors';

// Auth admin create - service-role path for operator provisioning (temp password, confirmed email).
export async function createAuthUser(
  admin: AdminSupabase,
  input: { email: string; password: string },
): Promise<{ id: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new RepositoryError('auth.create_user_failed', error?.message ?? 'missing user');
  }
  return { id: data.user.id };
}

// Auth admin delete - compensating action when profile/membership writes fail after createUser.
export async function deleteAuthUser(admin: AdminSupabase, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new RepositoryError('auth.delete_user_failed', error.message);
}
