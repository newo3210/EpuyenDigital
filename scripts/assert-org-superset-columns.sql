-- Assert organizations superset + org_settings after reconcile (task 2.1 proof).
-- Run after `npm run db:reset`, e.g.:
--   node scripts/supabase.mjs db query --file scripts/assert-org-superset-columns.sql
-- Or via: node scripts/assert-org-superset-columns.mjs
--
-- Raises if required columns are missing. Safe to re-run.

do $$
declare
  missing text[];
begin
  select array_agg(req.col)
    into missing
  from (values
    ('id'), ('name'), ('slug'), ('timezone'), ('created_at'), ('updated_at')
  ) as req(col)
  where not exists (
    select 1
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'organizations'
       and c.column_name = req.col
  );

  if missing is not null then
    raise exception 'organizations missing columns: %', array_to_string(missing, ', ');
  end if;

  if not exists (
    select 1
      from information_schema.tables
     where table_schema = 'public' and table_name = 'org_settings'
  ) then
    raise exception 'org_settings table missing';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'org_settings'
       and column_name = 'org_id'
  ) then
    raise exception 'org_settings missing org_id';
  end if;

  raise notice 'OK — organizations has id,name,slug,timezone,created_at,updated_at; org_settings.org_id present';
end $$;
