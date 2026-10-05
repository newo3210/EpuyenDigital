-- Second re-review fix (design D13, R-5): the atomic report insert rejects arguments that would disable the limit.

-- ---------------------------------------------------------------------------
-- Atomic client report insert - argument guard, per-user advisory lock, count inside the window, insert or null
-- ---------------------------------------------------------------------------
create or replace function public.insert_client_error_report(
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
  if p_user_id is null
    or p_limit is null or p_limit < 1
    or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

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
