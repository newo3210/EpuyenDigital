-- Areas, area_members, profile email/deactivation, current_area_ids, last-admin.
-- Change: areas-operators-admin (Phase 1 - FND-02..05, FND-06 area level)

-- ---------------------------------------------------------------------------
-- profiles: replicated email + deactivation timestamp
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists deactivated_at timestamptz;

comment on column public.profiles.email is
  'Replicated Auth email for directory listing; unique per org when not null.';
comment on column public.profiles.deactivated_at is
  'Set when is_active becomes false; cleared on reactivation.';

create unique index if not exists profiles_org_email_unique
  on public.profiles (org_id, lower(email))
  where email is not null;

-- Stamp / clear deactivated_at with is_active transitions.
create or replace function public.profiles_sync_deactivated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active = false and (tg_op = 'INSERT' or old.is_active is distinct from false) then
    new.deactivated_at := coalesce(new.deactivated_at, now());
  elsif new.is_active = true then
    new.deactivated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_deactivated_at on public.profiles;
create trigger profiles_sync_deactivated_at
  before insert or update of is_active, deactivated_at on public.profiles
  for each row execute function public.profiles_sync_deactivated_at();

-- Extend privileged-column guard: email and deactivated_at are admin-only from the API.
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Service role, migrations and seeds run as other database roles and are trusted.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if (new.role, new.org_id, new.is_active, new.email, new.deactivated_at)
       is distinct from
     (old.role, old.org_id, old.is_active, old.email, old.deactivated_at)
     and public.current_user_role() is distinct from 'admin' then
    raise exception 'forbidden_column'
      using errcode = 'P0001',
            hint = 'Only admins can change role, org_id, is_active, email or deactivated_at.';
  end if;

  return new;
end;
$$;

-- Last active admin: reject demotion or deactivation that would leave zero active admins.
create or replace function public.profiles_guard_last_active_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  remaining integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and old.is_active then
      select count(*)::integer into remaining
      from public.profiles p
      where p.org_id = old.org_id
        and p.role = 'admin'
        and p.is_active
        and p.id is distinct from old.id;
      if remaining = 0 then
        raise exception 'last_active_admin'
          using errcode = 'P0001',
                hint = 'Cannot remove the last active admin of the organization.';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'admin'
     and old.is_active
     and (new.role is distinct from 'admin' or new.is_active = false) then
    select count(*)::integer into remaining
    from public.profiles p
    where p.org_id = new.org_id
      and p.role = 'admin'
      and p.is_active
      and p.id is distinct from new.id;
    if remaining = 0 then
      raise exception 'last_active_admin'
        using errcode = 'P0001',
              hint = 'Cannot demote or deactivate the last active admin of the organization.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_last_active_admin on public.profiles;
create trigger profiles_guard_last_active_admin
  before update or delete on public.profiles
  for each row execute function public.profiles_guard_last_active_admin();

-- ---------------------------------------------------------------------------
-- areas
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  name text not null,
  description text,
  color text not null default '#1B4F72'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  is_default boolean not null default false,
  sla_warning_minutes integer
    check (sla_warning_minutes is null or sla_warning_minutes > 0),
  sla_critical_minutes integer
    check (sla_critical_minutes is null or sla_critical_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_sla_critical_gte_warning check (
    sla_warning_minutes is null
    or sla_critical_minutes is null
    or sla_critical_minutes >= sla_warning_minutes
  )
);

create index if not exists areas_org_id_idx on public.areas (org_id);

create unique index if not exists areas_org_name_unique
  on public.areas (org_id, lower(btrim(name)));

create unique index if not exists areas_one_default_per_org
  on public.areas (org_id)
  where is_default;

comment on table public.areas is
  'Municipal areas (verticals). Exactly one is_default per org after seed.';

drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

-- Single-default swap: promoting clears peers; clearing the sole default is rejected.
create or replace function public.areas_guard_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default then
    update public.areas a
       set is_default = false
     where a.org_id = new.org_id
       and a.id is distinct from new.id
       and a.is_default;
  elsif tg_op = 'UPDATE'
        and old.is_default
        and not new.is_default then
    if not exists (
      select 1
      from public.areas a
      where a.org_id = new.org_id
        and a.id is distinct from new.id
        and a.is_default
    ) then
      raise exception 'org_requires_default_area'
        using errcode = 'P0001',
              hint = 'An organization must keep exactly one default area.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists areas_guard_default on public.areas;
create trigger areas_guard_default
  before insert or update of is_default on public.areas
  for each row execute function public.areas_guard_default();

-- ---------------------------------------------------------------------------
-- area_members
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
  'Operator membership in a municipal area; members must share the area org.';

-- Same-org guard for memberships.
create or replace function public.area_members_same_org()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  area_org uuid;
  user_org uuid;
begin
  select a.org_id into area_org from public.areas a where a.id = new.area_id;
  select p.org_id into user_org from public.profiles p where p.id = new.user_id;

  if area_org is null or user_org is null or area_org is distinct from user_org then
    raise exception 'area_member_org_mismatch'
      using errcode = 'P0001',
            hint = 'area_members must link a profile and an area of the same organization.';
  end if;

  return new;
end;
$$;

drop trigger if exists area_members_same_org on public.area_members;
create trigger area_members_same_org
  before insert or update on public.area_members
  for each row execute function public.area_members_same_org();

-- ---------------------------------------------------------------------------
-- current_area_ids() - empty when inactive / no profile / no memberships
-- ---------------------------------------------------------------------------
create or replace function public.current_area_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select am.area_id
  from public.area_members am
  where am.user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active
    );
$$;

revoke execute on function public.current_area_ids() from public, anon;
grant execute on function public.current_area_ids() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.areas enable row level security;
alter table public.area_members enable row level security;

revoke all on public.areas, public.area_members from anon;
revoke all on public.areas, public.area_members from authenticated;
grant select, insert, update on public.areas to authenticated;
grant select, insert, update, delete on public.area_members to authenticated;
grant all on public.areas, public.area_members to service_role;

-- areas: org members read; only admin writes.
drop policy if exists areas_select on public.areas;
create policy areas_select on public.areas
  for select to authenticated
  using (org_id = public.current_org_id());

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

-- area_members: org members read via area org; admin mutates within org.
drop policy if exists area_members_select on public.area_members;
create policy area_members_select on public.area_members
  for select to authenticated
  using (
    exists (
      select 1
      from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
  );

drop policy if exists area_members_insert_admin on public.area_members;
create policy area_members_insert_admin on public.area_members
  for insert to authenticated
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1
      from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
    and exists (
      select 1
      from public.profiles p
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
      select 1
      from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
  )
  with check (
    public.current_user_role() = 'admin'
    and exists (
      select 1
      from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = user_id
        and p.org_id = public.current_org_id()
    )
  );

drop policy if exists area_members_delete_admin on public.area_members;
create policy area_members_delete_admin on public.area_members
  for delete to authenticated
  using (
    public.current_user_role() = 'admin'
    and exists (
      select 1
      from public.areas a
      where a.id = area_id
        and a.org_id = public.current_org_id()
    )
  );
