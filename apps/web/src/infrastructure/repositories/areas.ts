import { areaSchema, type Area, type Database } from '@epuyen/shared';
import { RepositoryError, type DbClient } from './errors';

// Row shape - columns read from public.areas.
type AreaRow = Pick<
  Database['public']['Tables']['areas']['Row'],
  | 'id'
  | 'org_id'
  | 'name'
  | 'description'
  | 'color'
  | 'is_active'
  | 'is_default'
  | 'sla_warning_minutes'
  | 'sla_critical_minutes'
>;

const AREA_COLUMNS =
  'id, org_id, name, description, color, is_active, is_default, sla_warning_minutes, sla_critical_minutes';

// Row mapping - snake_case row to validated camelCase domain area.
function toArea(row: AreaRow): Area {
  const parsed = areaSchema.safeParse({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    color: row.color,
    isActive: row.is_active,
    isDefault: row.is_default,
    slaWarningMinutes: row.sla_warning_minutes,
    slaCriticalMinutes: row.sla_critical_minutes,
  });
  if (!parsed.success) throw new RepositoryError('areas.invalid_row', parsed.error.message);
  return parsed.data;
}

// List areas - RLS scopes to org admin (all) or memberships.
export async function listAreas(client: DbClient): Promise<Area[]> {
  const { data, error } = await client.from('areas').select(AREA_COLUMNS).order('name');
  if (error) throw new RepositoryError('areas.read_failed', error.message);
  return (data ?? []).map(toArea);
}

// Insert area - admin RLS; returns the created row.
export async function insertArea(
  client: DbClient,
  input: {
    orgId: string;
    name: string;
    description: string | null;
    color: string | null;
    isActive: boolean;
  },
): Promise<Area> {
  const { data, error } = await client
    .from('areas')
    .insert({
      org_id: input.orgId,
      name: input.name,
      description: input.description,
      color: input.color,
      is_active: input.isActive,
      is_default: false,
    })
    .select(AREA_COLUMNS)
    .single();
  if (error) throw new RepositoryError('areas.write_failed', error.message);
  return toArea(data);
}

// Update area mutable fields - admin RLS.
export async function updateAreaRow(
  client: DbClient,
  input: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    isActive: boolean;
  },
): Promise<Area> {
  const { data, error } = await client
    .from('areas')
    .update({
      name: input.name,
      description: input.description,
      color: input.color,
      is_active: input.isActive,
    })
    .eq('id', input.id)
    .select(AREA_COLUMNS);
  if (error) throw new RepositoryError('areas.write_failed', error.message);
  const row = data?.[0];
  if (!row) throw new RepositoryError('areas.not_updated', 'no area row was updated');
  return toArea(row);
}

// Set default area - RPC clears the previous default in the same org.
export async function setDefaultArea(client: DbClient, areaId: string): Promise<void> {
  const { error } = await client.rpc('set_default_area', { p_area_id: areaId });
  if (error) throw new RepositoryError('areas.set_default_failed', error.message);
}
