-- Foundation hardening after adversarial review (design D11, 2026-10-05):
-- least-privilege grants, immutable profile identity, profile value checks,
-- org-scoped avatar listing, and the per-user index used by the report rate limit.

-- ---------------------------------------------------------------------------
-- Least privilege - authenticated keeps only SELECT/UPDATE (RLS-governed) on business tables
-- ---------------------------------------------------------------------------
revoke insert, delete, truncate, trigger, references
  on public.organizations, public.profiles, public.error_logs
  from authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.profiles_guard_privileged_columns() from public, anon, authenticated;
revoke execute on function public.error_logs_guard_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles guard - id and created_at are immutable for every API caller; privileged columns admin-only
-- ---------------------------------------------------------------------------
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

  if (new.id, new.created_at) is distinct from (old.id, old.created_at) then
    raise exception 'forbidden_column'
      using errcode = 'P0001',
            hint = 'id and created_at cannot be changed.';
  end if;

  if (new.role, new.org_id, new.is_active) is distinct from (old.role, old.org_id, old.is_active)
     and public.current_user_role() is distinct from 'admin' then
    raise exception 'forbidden_column'
      using errcode = 'P0001',
            hint = 'Only admins can change role, org_id or is_active.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile value checks - trimmed name length and avatar path inside the profile's own folder
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_full_name_trimmed_length
    check (char_length(btrim(full_name)) between 2 and 80),
  add constraint profiles_avatar_path_own_folder
    check (
      avatar_path is null
      or (
        avatar_path like org_id::text || '/' || id::text || '/%'
        and position('..' in avatar_path) = 0
      )
    );

-- ---------------------------------------------------------------------------
-- Storage - authenticated users list only avatars of their own organization (public URLs unaffected)
-- ---------------------------------------------------------------------------
drop policy avatars_select on storage.objects;

create policy avatars_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

-- ---------------------------------------------------------------------------
-- Report rate limit - recent client reports per user
-- ---------------------------------------------------------------------------
create index error_logs_user_created_idx on public.error_logs (user_id, created_at desc);
