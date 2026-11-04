import { profileSchema, type Database, type Profile, type Role } from '@epuyen/shared';
import { RepositoryError, type DbClient } from './errors';

// Row shape - profile columns used by the operators admin list.
type OperatorRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'org_id' | 'full_name' | 'avatar_path' | 'role' | 'is_active' | 'deactivated_at'
>;

const OPERATOR_COLUMNS = 'id, org_id, full_name, avatar_path, role, is_active, deactivated_at';

// Operator list item - profile plus email from auth (filled by the service layer).
export type OperatorListItem = Profile & { email: string | null; deactivatedAt: string | null };

// Row mapping - snake_case profile row to domain profile (with deactivatedAt).
function toProfile(row: OperatorRow): Profile & { deactivatedAt: string | null } {
  const parsed = profileSchema.safeParse({
    id: row.id,
    orgId: row.org_id,
    fullName: row.full_name,
    avatarPath: row.avatar_path,
    role: row.role,
    isActive: row.is_active,
    deactivatedAt: row.deactivated_at,
  });
  if (!parsed.success) throw new RepositoryError('operators.invalid_row', parsed.error.message);
  return { ...parsed.data, deactivatedAt: row.deactivated_at };
}

// List org profiles - caller must use a client that can see org rows (user or admin).
export async function listOrgProfiles(client: DbClient, orgId: string): Promise<Array<Profile & { deactivatedAt: string | null }>> {
  const { data, error } = await client
    .from('profiles')
    .select(OPERATOR_COLUMNS)
    .eq('org_id', orgId)
    .order('full_name');
  if (error) throw new RepositoryError('operators.read_failed', error.message);
  return (data ?? []).map(toProfile);
}

// Insert profile - service-role only (authenticated has no INSERT grant).
export async function insertOperatorProfile(
  client: DbClient,
  input: { id: string; orgId: string; fullName: string; role: Role },
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .insert({
      id: input.id,
      org_id: input.orgId,
      full_name: input.fullName,
      role: input.role,
      is_active: true,
    })
    .select(OPERATOR_COLUMNS)
    .single();
  if (error) throw new RepositoryError('operators.write_failed', error.message);
  return toProfile(data);
}

// Update operator privileged fields - admin RLS; maps last_admin from Postgres.
export async function updateOperatorProfile(
  client: DbClient,
  input: { userId: string; role?: Role; isActive?: boolean; fullName?: string },
): Promise<Profile & { deactivatedAt: string | null }> {
  const patch: Database['public']['Tables']['profiles']['Update'] = {};
  if (input.role !== undefined) patch.role = input.role;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.fullName !== undefined) patch.full_name = input.fullName;

  const { data, error } = await client
    .from('profiles')
    .update(patch)
    .eq('id', input.userId)
    .select(OPERATOR_COLUMNS);
  if (error) throw new RepositoryError('operators.write_failed', error.message);
  const row = data?.[0];
  if (!row) throw new RepositoryError('operators.not_updated', 'no profile row was updated');
  return toProfile(row);
}
