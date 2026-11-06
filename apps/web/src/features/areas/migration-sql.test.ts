import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Migration source - static contract when live Postgres/containers are unavailable.
const MIGRATION = resolve(
  process.cwd(),
  process.cwd().endsWith('apps/web')
    ? '../../supabase/migrations/20261106120000_areas_operators_admin.sql'
    : 'supabase/migrations/20261106120000_areas_operators_admin.sql',
);
const sql = readFileSync(MIGRATION, 'utf8');

// Structural assertions - uniqueness, default, color, SLA, RLS helpers, last-admin.
describe('areas-operators-admin migration SQL', () => {
  it('creates areas with color, SLA and single-default constraints', () => {
    expect(sql).toContain('create table if not exists public.areas');
    expect(sql).toContain("color ~ '^#[0-9A-Fa-f]{6}$'");
    expect(sql).toContain('areas_org_name_unique');
    expect(sql).toContain('lower(btrim(name))');
    expect(sql).toContain('areas_one_default_per_org');
    expect(sql).toContain('where is_default');
    expect(sql).toContain('sla_warning_minutes is null or sla_warning_minutes > 0');
    expect(sql).toContain('sla_critical_minutes >= sla_warning_minutes');
    expect(sql).toContain('areas_guard_default');
    expect(sql).toContain('org_requires_default_area');
  });

  it('skips sole-default check on nested trigger depth (promote/swap fix)', () => {
    expect(sql).toContain('pg_trigger_depth() > 1');
  });

  it('creates area_members with same-org guard and composite PK', () => {
    expect(sql).toContain('create table if not exists public.area_members');
    expect(sql).toContain('primary key (area_id, user_id)');
    expect(sql).toContain('area_members_same_org');
    expect(sql).toContain('area_member_org_mismatch');
  });

  it('adds profiles.email uniqueness and deactivated_at sync', () => {
    expect(sql).toContain('add column if not exists email text');
    expect(sql).toContain('add column if not exists deactivated_at timestamptz');
    expect(sql).toContain('profiles_org_email_unique');
    expect(sql).toContain('profiles_sync_deactivated_at');
  });

  it('exposes current_area_ids and last-active-admin protection with lock + org move', () => {
    expect(sql).toContain('create or replace function public.current_area_ids()');
    expect(sql).toContain('returns setof uuid');
    expect(sql).toContain('profiles_guard_last_active_admin');
    expect(sql).toContain('last_active_admin');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('hashtextextended');
    expect(sql).toContain('new.org_id is distinct from old.org_id');
  });

  it('provides atomic replace_area_memberships RPC', () => {
    expect(sql).toContain('create or replace function public.replace_area_memberships');
    expect(sql).toContain('p_memberships jsonb');
    expect(sql).toContain('delete from public.area_members');
    expect(sql).toContain('jsonb_array_elements(p_memberships)');
  });

  it('enables RLS with org isolation and admin-only writes', () => {
    expect(sql).toContain('alter table public.areas enable row level security');
    expect(sql).toContain('alter table public.area_members enable row level security');
    expect(sql).toContain("public.current_user_role() = 'admin'");
    expect(sql).toContain('org_id = public.current_org_id()');
  });
});
