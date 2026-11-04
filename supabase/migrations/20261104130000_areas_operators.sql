-- Areas and operators admin (Phase 1 FND-02..06 area scaffolding).
-- Tables: areas, area_members; profiles.deactivated_at; whatsapp_lines.default_area_id;
-- Helpers: operator_area_ids(), set_default_area(); last-admin protection; RLS.

-- ---------------------------------------------------------------------------
-- Areas
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  color text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sla_warning_minutes integer,
  sla_critical_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_name_trimmed_length check (char_length(btrim(name)) between 1 and 80),
  constraint areas_sla_order check (
    sla_warning_minutes is null
    or sla_critical_minutes is null
    or sla_critical_minutes >= sla_warning_minutes
  )
);

create unique index if not exists areas_org_id_name_uidx
  on public.areas (org_id, lower(btrim(name)));

-- Exactly one default area per organization (partial unique).
create unique index if not exists areas_one_default_per_org_uidx
  on public.areas (org_id)
  where is_default;

create index if not exists areas_org_id_idx on public.areas (org_id);

drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

comment on table public.areas is
  'Municipal areas (Mesa de Entrada hub + verticals). Exactly one is_default per org.';

-- ---------------------------------------------------------------------------
-- Area members
-- ---------------------------------------------------------------------------
create table if not exists public.area_members (
  area_id uuid not null references public.areas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (area_id, user_id)
);

create index if not exists area_members_user_id_idx on public.area_members (user_id);

comment on table public.area_members is
  'Operator membership in municipal areas; is_lead marks the area lead.';

-- ---------------------------------------------------------------------------
-- profiles.deactivated_at
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists deactivated_at timestamptz;

comment on column public.profiles.deactivated_at is
  'Set when is_active becomes false; cleared on reactivate. Sign-in still blocked by is_active.';

-- ---------------------------------------------------------------------------
-- whatsapp_lines.default_area_id (nullable FK)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'whatsapp_lines'
      and column_name = 'default_area_id'
  ) then
    alter table public.whatsapp_lines
      add column default_area_id uuid references public.areas (id) on delete set null;
  end if;
end $$;

create index if not exists whatsapp_lines_default_area_id_idx
  on public.whatsapp_lines (default_area_id);

-- ---------------------------------------------------------------------------
-- Sync deactivated_at when is_active flips
-- ---------------------------------------------------------------------------
create or replace function public.profiles_sync_deactivated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active is distinct from old.is_active then
    if new.is_active = false then
      new.deactivated_at := coalesce(new.deactivated_at, now());
    else
      new.deactivated_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_deactivated_at on public.profiles;
create trigger profiles_sync_deactivated_at
  before update on public.profiles
  for each row execute function public.profiles_sync_deactivated_at();

revoke execute on function public.profiles_sync_deactivated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Last-admin protection - cannot demote or deactivate the sole active admin
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  other_active_admins integer;
  demoting boolean;
  deactivating boolean;
begin
  -- Only care when the row was an active admin and loses admin or active status.
  if old.role is distinct from 'admin' or old.is_active is not true then
    return new;
  end if;

  demoting := new.role is distinct from 'admin';
  deactivating := new.is_active is not true;

  if not demoting and not deactivating then
    return new;
  end if;

  select count(*)::integer into other_active_admins
  from public.profiles p
  where p.org_id = old.org_id
    and p.id is distinct from old.id
    and p.role = 'admin'
    and p.is_active;

  if other_active_admins = 0 then
    raise exception 'last_admin'
      using errcode = 'P0001',
            hint = 'Cannot deactivate or demote the last active admin in the organization.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_last_admin on public.profiles;
create trigger profiles_guard_last_admin
  before update on public.profiles
  for each row execute function public.profiles_guard_last_admin();

revoke execute on function public.profiles_guard_last_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- operator_area_ids - caller's membership area ids (for future conversation RLS)
-- ---------------------------------------------------------------------------
create or replace function public.operator_area_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select am.area_id
  from public.area_members am
  inner join public.areas a on a.id = am.area_id
  where am.user_id = auth.uid()
    and a.org_id = (select p.org_id from public.profiles p where p.id = auth.uid() and p.is_active)
$$;

revoke execute on function public.operator_area_ids() from public, anon;
grant execute on function public.operator_area_ids() to authenticated, service_role;

comment on function public.operator_area_ids() is
  'Returns area ids the caller belongs to. Conversations RLS attaches later (inbox change).';

-- ---------------------------------------------------------------------------
-- set_default_area - clear previous default, mark target (admin, same org)
-- ---------------------------------------------------------------------------
create or replace function public.set_default_area(p_area_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'forbidden'
      using errcode = 'P0001',
            hint = 'Only admins can set the default area.';
  end if;

  select a.org_id into target_org
  from public.areas a
  where a.id = p_area_id;

  if target_org is null then
    raise exception 'area_not_found'
      using errcode = 'P0001',
            hint = 'Area does not exist.';
  end if;

  if target_org is distinct from public.current_org_id() then
    raise exception 'forbidden'
      using errcode = 'P0001',
            hint = 'Area belongs to another organization.';
  end if;

  update public.areas
  set is_default = false
  where org_id = target_org
    and is_default
    and id is distinct from p_area_id;

  update public.areas
  set is_default = true
  where id = p_area_id;
end;
$$;

revoke execute on function public.set_default_area(uuid) from public, anon;
grant execute on function public.set_default_area(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.areas enable row level security;
alter table public.area_members enable row level security;

revoke all on public.areas, public.area_members from anon;
revoke insert, delete, truncate, trigger, references on public.areas, public.area_members from authenticated;
grant select, insert, update on public.areas to authenticated;
grant select, insert, update, delete on public.area_members to authenticated;

-- areas: admin reads/writes all org areas; members read areas they belong to.
drop policy if exists areas_select on public.areas;
create policy areas_select on public.areas
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() = 'admin'
      or id in (select public.operator_area_ids())
    )
  );

drop policy if exists areas_insert_admin on public.areas;
create policy areas_insert_admin on public.areas
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

drop policy if exists areas_update_admin on public.areas;
create policy areas_update_admin on public.areas
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  )
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

-- No client DELETE on areas (deactivate via is_active instead).
revoke delete on public.areas from authenticated;

-- area_members: admin full CRUD in org; members can read memberships of their areas.
drop policy if exists area_members_select on public.area_members;
create policy area_members_select on public.area_members
  for select to authenticated
  using (
    exists (
      select 1 from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
        and (
          public.current_user_role() = 'admin'
          or a.id in (select public.operator_area_ids())
        )
    )
  );

drop policy if exists area_members_insert_admin on public.area_members;
create policy area_members_insert_admin on public.area_members
  for insert to authenticated
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
    and exists (
      select 1 from public.profiles p
      where p.id = user_id
        and p.org_id = public.current_org_id()
    )
  );

drop policy if exists area_members_update_admin on public.area_members;
create policy area_members_update_admin on public.area_members
  for update to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
  );

drop policy if exists area_members_delete_admin on public.area_members;
create policy area_members_delete_admin on public.area_members
  for delete to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1 from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
  );
