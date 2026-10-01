import { profileSchema, type Database, type Profile } from '@epuyen/shared';
import { RepositoryError, type DbClient } from './errors';

// Row shape - columns read from public.profiles.
type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'org_id' | 'full_name' | 'avatar_path' | 'role' | 'is_active'
>;

// Selected columns - must match ProfileRow.
const PROFILE_COLUMNS = 'id, org_id, full_name, avatar_path, role, is_active';

// Row mapping - snake_case row to validated camelCase domain profile.
function toProfile(row: ProfileRow): Profile {
  const parsed = profileSchema.safeParse({
    id: row.id,
    orgId: row.org_id,
    fullName: row.full_name,
    avatarPath: row.avatar_path,
    role: row.role,
    isActive: row.is_active,
  });
  if (!parsed.success) throw new RepositoryError('profiles.invalid_row', parsed.error.message);
  return parsed.data;
}

// Lookup - profile by user id; callers pass the admin client when inactive profiles must be visible.
export async function findProfileById(client: DbClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw new RepositoryError('profiles.read_failed', error.message);
  return data ? toProfile(data) : null;
}

// Update guard - zero affected rows means RLS rejected the write (or the row is gone).
function assertUpdated(data: { id: string }[] | null, error: { message: string } | null): void {
  if (error) throw new RepositoryError('profiles.write_failed', error.message);
  if (!data || data.length === 0) throw new RepositoryError('profiles.not_updated', 'no profile row was updated');
}

// Self-service writes - display name and avatar object path (RLS: own row, active profile).
export async function updateProfileName(client: DbClient, userId: string, fullName: string): Promise<void> {
  const { data, error } = await client.from('profiles').update({ full_name: fullName }).eq('id', userId).select('id');
  assertUpdated(data, error);
}

export async function updateProfileAvatarPath(client: DbClient, userId: string, avatarPath: string | null): Promise<void> {
  const { data, error } = await client
    .from('profiles')
    .update({ avatar_path: avatarPath })
    .eq('id', userId)
    .select('id');
  assertUpdated(data, error);
}
