import type { Database, Role } from '@epuyen/shared';
import {
  operatorDirectorySchema,
  type MembershipInput,
  type OperatorDirectoryEntry,
} from '@/contracts/operators';
import { RepositoryError, type DbClient } from './errors';

// Profile directory row - columns used by the operators list.
type ProfileDirectoryRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'email' | 'full_name' | 'role' | 'is_active' | 'deactivated_at'
>;

// Membership join row - area id/name plus lead flag for directory display.
type MembershipJoinRow = {
  area_id: string;
  is_lead: boolean;
  areas: { name: string } | { name: string }[] | null;
};

const PROFILE_COLUMNS = 'id, email, full_name, role, is_active, deactivated_at';

// Area name helper - PostgREST may return object or one-element array for the embed.
function areaNameFromJoin(areas: MembershipJoinRow['areas']): string | null {
  if (!areas) return null;
  if (Array.isArray(areas)) return areas[0]?.name ?? null;
  return areas.name ?? null;
}

// Directory mapping - profiles plus nested memberships into the UI contract.
function toDirectoryEntry(
  row: ProfileDirectoryRow,
  memberships: Array<{ areaId: string; areaName: string; isLead: boolean }>,
): OperatorDirectoryEntry {
  const parsed = operatorDirectorySchema.safeParse({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    deactivatedAt: row.deactivated_at,
    memberships,
  });
  if (!parsed.success) throw new RepositoryError('operators.invalid_row', parsed.error.message);
  return parsed.data;
}

// List - org profiles with area memberships (RLS scopes both tables).
export async function listOperators(client: DbClient): Promise<OperatorDirectoryEntry[]> {
  const { data: profiles, error: profileError } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('full_name', { ascending: true });
  if (profileError) throw new RepositoryError('operators.read_failed', profileError.message);

  const { data: memberships, error: memberError } = await client
    .from('area_members')
    .select('user_id, area_id, is_lead, areas(name)');
  if (memberError) throw new RepositoryError('operators.read_failed', memberError.message);

  const byUser = new Map<string, Array<{ areaId: string; areaName: string; isLead: boolean }>>();
  for (const row of memberships ?? []) {
    const join = row as unknown as MembershipJoinRow & { user_id: string };
    const name = areaNameFromJoin(join.areas);
    if (!name) continue;
    const list = byUser.get(join.user_id) ?? [];
    list.push({ areaId: join.area_id, areaName: name, isLead: join.is_lead });
    byUser.set(join.user_id, list);
  }

  return (profiles as ProfileDirectoryRow[]).map((profile) =>
    toDirectoryEntry(profile, byUser.get(profile.id) ?? []),
  );
}

// Insert profile - service-role path used after Auth createUser (authenticated has no INSERT).
export async function insertOperatorProfile(
  client: DbClient,
  input: { id: string; orgId: string; email: string; fullName: string; role: Role },
): Promise<void> {
  const { error } = await client.from('profiles').insert({
    id: input.id,
    org_id: input.orgId,
    email: input.email,
    full_name: input.fullName,
    role: input.role,
    is_active: true,
  });
  if (error) throw new RepositoryError('operators.profile_write_failed', error.message);
}

// Update role - admin RLS path; last-admin trigger may reject.
export async function updateOperatorRole(client: DbClient, userId: string, role: Role): Promise<void> {
  const { data, error } = await client.from('profiles').update({ role }).eq('id', userId).select('id');
  if (error) throw new RepositoryError('operators.role_write_failed', error.message);
  if (!data || data.length === 0) throw new RepositoryError('operators.role_write_failed', 'no profile row was updated');
}

// Set active flag - deactivation stamps deactivated_at via DB trigger; reactivation clears it.
export async function setOperatorActive(client: DbClient, userId: string, isActive: boolean): Promise<void> {
  const { data, error } = await client
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id');
  if (error) throw new RepositoryError('operators.active_write_failed', error.message);
  if (!data || data.length === 0) {
    throw new RepositoryError('operators.active_write_failed', 'no profile row was updated');
  }
}

// Replace memberships - atomic RPC (delete+insert in one transaction; fails closed on insert error).
export async function replaceOperatorMemberships(
  client: DbClient,
  userId: string,
  memberships: MembershipInput[],
): Promise<void> {
  const payload = memberships.map((membership) => ({
    area_id: membership.areaId,
    is_lead: membership.isLead,
  }));
  const { error } = await client.rpc('replace_area_memberships', {
    p_user_id: userId,
    p_memberships: payload,
  });
  if (error) throw new RepositoryError('operators.memberships_write_failed', error.message);
}

// Count active admins - used by application-level last-admin messaging before the DB trigger.
export async function countActiveAdmins(client: DbClient, orgId: string): Promise<number> {
  const { count, error } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'admin')
    .eq('is_active', true);
  if (error) throw new RepositoryError('operators.count_admins_failed', error.message);
  return count ?? 0;
}

// Find profile by id within org scope - used to detect last-admin before mutate.
export async function findOperatorProfile(
  client: DbClient,
  userId: string,
): Promise<{ id: string; role: Role; isActive: boolean; email: string | null } | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, role, is_active, email')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new RepositoryError('operators.read_failed', error.message);
  if (!data) return null;
  return {
    id: data.id,
    role: data.role as Role,
    isActive: data.is_active,
    email: data.email,
  };
}
