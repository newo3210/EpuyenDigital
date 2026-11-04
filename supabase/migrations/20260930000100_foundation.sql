-- Foundation: organizations, operator profiles, RLS helpers, error logs, avatars bucket.
-- Change: foundation-workspace-auth (Phase 1 - FND-01, FND-06 org level, FND-07, FND-08)
--
-- Idempotency note (reconcile-foundation-to-main, 2026-11-04):
-- This branch has NOT shipped foundation migrations to production. DDL is written
-- with IF NOT EXISTS / duplicate_object / DROP IF EXISTS so pet-only databases that
-- already have `organizations` (and `set_updated_at`) can apply this migration
-- forward without failing. Fresh reset still creates the same objects.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'area_lead', 'operator', 'support');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.error_level as enum ('error', 'warn', 'info');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.error_status as enum ('open', 'acknowledged', 'resolved');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
-- organizations may already exist from pet migrations (superset columns).
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id),
  full_name text not null check (char_length(full_name) between 2 and 80),
  avatar_path text,
  role public.user_role not null default 'operator',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_org_id_idx on public.profiles (org_id);

comment on column public.profiles.avatar_path is
  'Object path inside storage bucket avatars: {org_id}/{user_id}/{uuid}.{ext}';

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  source text not null check (source in ('web', 'api', 'worker', 'db')),
  level public.error_level not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  trace_id text not null,
  user_id uuid,
  status public.error_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_org_status_created_idx on public.error_logs (org_id, status, created_at desc);
create index if not exists error_logs_trace_id_idx on public.error_logs (trace_id);

comment on table public.error_logs is
  'Redacted incidents. Insert: service role only. Select/update status: admin + support of the org (null org: support). Purged after 30 days.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers - null for callers without an active profile, so policies match nothing
-- ---------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.org_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

revoke execute on function public.current_org_id() from public, anon;
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_org_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profiles guard - only admins may change role, org_id or is_active from the API
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

  if (new.role, new.org_id, new.is_active) is distinct from (old.role, old.org_id, old.is_active)
     and public.current_user_role() is distinct from 'admin' then
    raise exception 'forbidden_column'
      using errcode = 'P0001',
            hint = 'Only admins can change role, org_id or is_active.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

-- ---------------------------------------------------------------------------
-- Error logs guard - authenticated callers may change only status; resolution is stamped here
-- ---------------------------------------------------------------------------
create or replace function public.error_logs_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (new.id, new.org_id, new.source, new.level, new.message, new.details, new.trace_id, new.user_id, new.created_at)
         is distinct from
         (old.id, old.org_id, old.source, old.level, old.message, old.details, old.trace_id, old.user_id, old.created_at) then
    raise exception 'forbidden_column'
      using errcode = 'P0001',
            hint = 'Only status can be changed on error_logs.';
  end if;

  if new.status = 'resolved' then
    if old.status is distinct from 'resolved' then
      new.resolved_by := auth.uid();
      new.resolved_at := now();
    else
      new.resolved_by := old.resolved_by;
      new.resolved_at := old.resolved_at;
    end if;
  else
    new.resolved_by := null;
    new.resolved_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists error_logs_guard_update on public.error_logs;
create trigger error_logs_guard_update
  before update on public.error_logs
  for each row execute function public.error_logs_guard_update();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.error_logs enable row level security;

revoke all on public.organizations, public.profiles, public.error_logs from anon;

-- organizations: members read their own org; no client writes.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = public.current_org_id());

-- profiles: org members read; self updates own row; admins update rows of their org.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and org_id = public.current_org_id())
  with check (id = auth.uid() and org_id = public.current_org_id());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (org_id = public.current_org_id() and public.current_user_role() = 'admin')
  with check (org_id = public.current_org_id());

-- error_logs: admin/support of the org; rows without org visible to support only; no client inserts.
drop policy if exists error_logs_select on public.error_logs;
create policy error_logs_select on public.error_logs
  for select to authenticated
  using (
    public.current_user_role() in ('admin', 'support')
    and (
      org_id = public.current_org_id()
      or (org_id is null and public.current_user_role() = 'support')
    )
  );

drop policy if exists error_logs_update on public.error_logs;
create policy error_logs_update on public.error_logs
  for update to authenticated
  using (
    public.current_user_role() in ('admin', 'support')
    and (
      org_id = public.current_org_id()
      or (org_id is null and public.current_user_role() = 'support')
    )
  )
  with check (
    public.current_user_role() in ('admin', 'support')
    and (
      org_id = public.current_org_id()
      or (org_id is null and public.current_user_role() = 'support')
    )
  );

-- ---------------------------------------------------------------------------
-- Retention - purge error logs older than 30 days (service role / scheduler only)
-- ---------------------------------------------------------------------------
create or replace function public.purge_error_logs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.error_logs where created_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.purge_error_logs() from public, anon, authenticated;
grant execute on function public.purge_error_logs() to service_role;

-- Daily at 06:00 UTC (03:00 America/Argentina/Buenos_Aires) where pg_cron is available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-error-logs', '0 6 * * *', 'select public.purge_error_logs()');
  else
    raise notice 'pg_cron not available; schedule public.purge_error_logs() externally';
  end if;
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: public avatars bucket, writes only inside {org_id}/{user_id}/
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
