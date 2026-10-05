-- Client report rate limit (design D12, 2026-10-05): a dedicated origin column and an atomic
-- count-and-insert, so truncated details and concurrent requests cannot bypass the per-user limit.

-- ---------------------------------------------------------------------------
-- Origin column - server-captured rows (default) vs browser reports; backfilled from details
-- ---------------------------------------------------------------------------
alter table public.error_logs
  add column origin text not null default 'server'
    constraint error_logs_origin_check check (origin in ('server', 'client'));

update public.error_logs
set origin = 'client', details = details - 'origin'
where details ->> 'origin' = 'client';

-- ---------------------------------------------------------------------------
-- Index - only client reports are counted per user
-- ---------------------------------------------------------------------------
drop index public.error_logs_user_created_idx;

create index error_logs_client_reports_idx
  on public.error_logs (user_id, created_at desc)
  where origin = 'client';

-- ---------------------------------------------------------------------------
-- Update guard - origin joins the columns API callers can never change
-- ---------------------------------------------------------------------------
create or replace function public.error_logs_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (new.id, new.org_id, new.source, new.level, new.message, new.details, new.trace_id, new.user_id, new.created_at, new.origin)
         is distinct from
         (old.id, old.org_id, old.source, old.level, old.message, old.details, old.trace_id, old.user_id, old.created_at, old.origin) then
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

revoke execute on function public.error_logs_guard_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic client report insert - per-user advisory lock, count inside the window, insert or null
-- ---------------------------------------------------------------------------
create function public.insert_client_error_report(
  p_org_id uuid,
  p_user_id uuid,
  p_trace_id text,
  p_message text,
  p_details jsonb,
  p_limit integer,
  p_window_seconds integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recent integer;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('client_error_report:' || p_user_id::text, 0));

  select count(*) into recent
  from public.error_logs
  where user_id = p_user_id
    and origin = 'client'
    and created_at > now() - make_interval(secs => p_window_seconds);

  if recent >= p_limit then
    return null;
  end if;

  insert into public.error_logs (org_id, user_id, source, level, origin, message, details, trace_id)
  values (p_org_id, p_user_id, 'web', 'error', 'client', p_message, coalesce(p_details, '{}'::jsonb), p_trace_id)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.insert_client_error_report(uuid, uuid, text, text, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.insert_client_error_report(uuid, uuid, text, text, jsonb, integer, integer)
  to service_role;
