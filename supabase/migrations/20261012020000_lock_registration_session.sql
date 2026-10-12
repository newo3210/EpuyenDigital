-- lock_registration_session - SELECT … FOR UPDATE on the session row (design D4)

create or replace function public.lock_registration_session(
  p_line_id uuid,
  p_phone text
)
returns setof public.registration_sessions
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select s.*
  from public.registration_sessions s
  where s.line_id = p_line_id
    and s.phone_normalized = p_phone
  for update;
end;
$$;

revoke all on function public.lock_registration_session(uuid, text) from public;
grant execute on function public.lock_registration_session(uuid, text) to service_role;

-- mark_session_completion - atomically store completedAnimalId when still unset
create or replace function public.mark_session_completion(
  p_session_id uuid,
  p_animal_id uuid,
  p_municipal_id text,
  p_payload jsonb default null
)
returns table (animal_id uuid, municipal_id text, already_done boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.registration_sessions%rowtype;
  v_existing text;
begin
  select * into v_session
  from public.registration_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  v_existing := v_session.payload ->> 'completedAnimalId';
  if v_existing is not null and length(v_existing) > 0 then
    animal_id := v_existing::uuid;
    municipal_id := coalesce(v_session.payload ->> 'completedMunicipalId', p_municipal_id);
    already_done := true;
    return next;
    return;
  end if;

  update public.registration_sessions
  set
    step = 'done',
    payload = coalesce(p_payload, v_session.payload) || jsonb_build_object(
      'completedAnimalId', p_animal_id::text,
      'completedMunicipalId', p_municipal_id
    )
  where id = p_session_id;

  animal_id := p_animal_id;
  municipal_id := p_municipal_id;
  already_done := false;
  return next;
end;
$$;

revoke all on function public.mark_session_completion(uuid, uuid, text, jsonb) from public;
grant execute on function public.mark_session_completion(uuid, uuid, text, jsonb) to service_role;
