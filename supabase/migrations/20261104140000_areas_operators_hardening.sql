-- Adversarial hardening for areas / operators:
-- 1) Forbid authenticated clients from clearing is_default (must use set_default_area).
-- 2) Serialize last-admin checks with a per-org advisory lock.
-- 3) Refresh set_default_area (SECURITY DEFINER) so RPC can still move the default.

-- ---------------------------------------------------------------------------
-- Block clearing is_default via direct UPDATE as authenticated
-- ---------------------------------------------------------------------------
create or replace function public.areas_guard_default_clear()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Service role / migrations / seeds run as other DB roles and remain trusted.
  -- Authenticated admins must move the default via set_default_area (SECURITY DEFINER).
  if current_user = 'authenticated'
     and old.is_default is true
     and new.is_default is not true then
    raise exception 'cannot_clear_default'
      using errcode = 'P0001',
            hint = 'Clearing is_default is only allowed via set_default_area so the org keeps exactly one default.';
  end if;

  return new;
end;
$$;

drop trigger if exists areas_guard_default_clear on public.areas;
create trigger areas_guard_default_clear
  before update on public.areas
  for each row execute function public.areas_guard_default_clear();

revoke execute on function public.areas_guard_default_clear() from public, anon, authenticated;

comment on function public.areas_guard_default_clear() is
  'Prevents authenticated clients from clearing is_default; use set_default_area to move Mesa.';

-- ---------------------------------------------------------------------------
-- Last-admin: advisory lock before counting other admins (closes TOCTOU race)
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

  -- Serialize demote/deactivate checks per org within the transaction.
  perform pg_advisory_xact_lock(hashtext(old.org_id::text));

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

-- ---------------------------------------------------------------------------
-- set_default_area - unchanged contract; SECURITY DEFINER bypasses clear guard
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
