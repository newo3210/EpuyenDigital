import { areaMembershipSchema, type AreaMembership, type Database } from '@epuyen/shared';
import { RepositoryError, type DbClient } from './errors';

// Row shape - columns read from public.area_members.
type MembershipRow = Pick<Database['public']['Tables']['area_members']['Row'], 'area_id' | 'user_id' | 'is_lead'>;

const MEMBERSHIP_COLUMNS = 'area_id, user_id, is_lead';

// Row mapping - snake_case to camelCase membership.
function toMembership(row: MembershipRow): AreaMembership {
  const parsed = areaMembershipSchema.safeParse({
    areaId: row.area_id,
    userId: row.user_id,
    isLead: row.is_lead,
  });
  if (!parsed.success) throw new RepositoryError('area_members.invalid_row', parsed.error.message);
  return parsed.data;
}

// List memberships for a user - RLS applies.
export async function listMembershipsForUser(client: DbClient, userId: string): Promise<AreaMembership[]> {
  const { data, error } = await client.from('area_members').select(MEMBERSHIP_COLUMNS).eq('user_id', userId);
  if (error) throw new RepositoryError('area_members.read_failed', error.message);
  return (data ?? []).map(toMembership);
}

// List all memberships visible to the caller (admin: org; member: own areas).
export async function listMemberships(client: DbClient): Promise<AreaMembership[]> {
  const { data, error } = await client.from('area_members').select(MEMBERSHIP_COLUMNS);
  if (error) throw new RepositoryError('area_members.read_failed', error.message);
  return (data ?? []).map(toMembership);
}

// Assign membership - upsert so re-assigning lead flag is idempotent.
export async function upsertMembership(
  client: DbClient,
  input: { areaId: string; userId: string; isLead: boolean },
): Promise<AreaMembership> {
  const { data, error } = await client
    .from('area_members')
    .upsert(
      { area_id: input.areaId, user_id: input.userId, is_lead: input.isLead },
      { onConflict: 'area_id,user_id' },
    )
    .select(MEMBERSHIP_COLUMNS)
    .single();
  if (error) throw new RepositoryError('area_members.write_failed', error.message);
  return toMembership(data);
}

// Remove membership - admin RLS.
export async function deleteMembership(client: DbClient, areaId: string, userId: string): Promise<void> {
  const { error, count } = await client
    .from('area_members')
    .delete({ count: 'exact' })
    .eq('area_id', areaId)
    .eq('user_id', userId);
  if (error) throw new RepositoryError('area_members.write_failed', error.message);
  if (count === 0) throw new RepositoryError('area_members.not_deleted', 'no membership row was deleted');
}
