import { type Database } from '@epuyen/shared';
import { areaSchema, type Area } from '@/contracts/areas';
import { RepositoryError, type DbClient } from './errors';

// Row shape - columns read from public.areas.
type AreaRow = Database['public']['Tables']['areas']['Row'];

// Selected columns - must match AreaRow mapping.
const AREA_COLUMNS =
  'id, org_id, name, description, color, is_active, is_default, sla_warning_minutes, sla_critical_minutes';

// Row mapping - snake_case row to validated camelCase area.
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

// List - organization areas visible under RLS (org members).
export async function listAreas(client: DbClient): Promise<Area[]> {
  const { data, error } = await client.from('areas').select(AREA_COLUMNS).order('name', { ascending: true });
  if (error) throw new RepositoryError('areas.read_failed', error.message);
  return (data ?? []).map((row) => toArea(row as AreaRow));
}

// Lookup - single area by id within RLS scope.
export async function findAreaById(client: DbClient, areaId: string): Promise<Area | null> {
  const { data, error } = await client.from('areas').select(AREA_COLUMNS).eq('id', areaId).maybeSingle();
  if (error) throw new RepositoryError('areas.read_failed', error.message);
  return data ? toArea(data as AreaRow) : null;
}

// Write payload - snake_case columns for insert/update.
type AreaWrite = {
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  is_default: boolean;
  sla_warning_minutes: number | null;
  sla_critical_minutes: number | null;
};

// Update guard - zero affected rows means RLS rejected the write (or the row is gone).
function assertWritten(data: { id: string }[] | null, error: { message: string } | null, code: string): string {
  if (error) throw new RepositoryError(code, error.message);
  const row = data?.[0];
  if (!row) throw new RepositoryError(code, 'no area row was written');
  return row.id;
}

// Insert - admin creates an area for the caller's organization (RLS + org_id from caller).
export async function insertArea(client: DbClient, orgId: string, input: AreaWrite): Promise<Area> {
  const { data, error } = await client
    .from('areas')
    .insert({ org_id: orgId, ...input })
    .select(AREA_COLUMNS);
  const id = assertWritten(data, error, 'areas.write_failed');
  const created = (data as AreaRow[]).find((row) => row.id === id);
  if (!created) throw new RepositoryError('areas.write_failed', 'inserted area missing from select');
  return toArea(created);
}

// Update - admin mutates an area of the caller's organization.
export async function updateArea(client: DbClient, areaId: string, input: AreaWrite): Promise<Area> {
  const { data, error } = await client.from('areas').update(input).eq('id', areaId).select(AREA_COLUMNS);
  const id = assertWritten(data, error, 'areas.write_failed');
  const updated = (data as AreaRow[]).find((row) => row.id === id);
  if (!updated) throw new RepositoryError('areas.write_failed', 'updated area missing from select');
  return toArea(updated);
}
