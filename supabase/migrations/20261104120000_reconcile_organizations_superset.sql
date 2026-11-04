-- Reconcile organizations to foundation+pet superset (D2).
-- Foundation migration creates organizations without timezone/updated_at;
-- pet migration uses CREATE TABLE IF NOT EXISTS so those columns would be missing
-- on a fresh reset. This forward-only migration adds them idempotently and
-- restores a search_path-safe set_updated_at helper.

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

alter table public.organizations
  add column if not exists timezone text not null default 'America/Argentina/Buenos_Aires';

alter table public.organizations
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'organizations_set_updated_at'
      and tgrelid = 'public.organizations'::regclass
  ) then
    create trigger organizations_set_updated_at
      before update on public.organizations
      for each row execute function public.set_updated_at();
  end if;
end $$;

comment on column public.organizations.timezone is
  'IANA timezone for the municipality (pet registry default America/Argentina/Buenos_Aires).';
