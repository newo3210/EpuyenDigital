-- session processing lease - exclusivity for process_inbound across PostgREST (no spanning FOR UPDATE)
-- Also fix finalize lock order: advisory first, then row FOR UPDATE (match upsert)

alter table public.registration_sessions
  add column if not exists processing_owner text,
  add column if not exists processing_until timestamptz;

-- claim_session_processing - advisory + row lock; set lease if free or owned by caller
create or replace function public.claim_session_processing(
  p_line_id uuid,
  p_phone text,
  p_owner text,
  p_ttl_seconds int default 60
)
returns public.registration_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.registration_sessions;
begin
  perform pg_advisory_xact_lock(hashtext(p_line_id::text || ':' || p_phone));

  select * into v_row
  from public.registration_sessions
  where line_id = p_line_id and phone_normalized = p_phone
  for update;

  if not found then
    return null;
  end if;

  if v_row.processing_until is not null
     and v_row.processing_until > now()
     and v_row.processing_owner is distinct from p_owner then
    raise exception 'SESSION_BUSY';
  end if;

  update public.registration_sessions
  set
    processing_owner = p_owner,
    processing_until = now() + make_interval(secs => greatest(p_ttl_seconds, 5))
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.claim_session_processing(uuid, text, text, int) from public;
grant execute on function public.claim_session_processing(uuid, text, text, int) to service_role;

-- release_session_processing - clear lease if owned by caller
create or replace function public.release_session_processing(
  p_line_id uuid,
  p_phone text,
  p_owner text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_line_id::text || ':' || p_phone));

  update public.registration_sessions
  set processing_owner = null, processing_until = null
  where line_id = p_line_id
    and phone_normalized = p_phone
    and processing_owner = p_owner;
end;
$$;

revoke all on function public.release_session_processing(uuid, text, text) from public;
grant execute on function public.release_session_processing(uuid, text, text) to service_role;

-- finalize: advisory FIRST then FOR UPDATE (same order as upsert / claim)
create or replace function public.finalize_registration_completion(
  p_session_id uuid,
  p_citizen_id uuid,
  p_payload jsonb,
  p_photos jsonb default '[]'::jsonb
)
returns table (
  animal_id uuid,
  municipal_id text,
  already_done boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.registration_sessions%rowtype;
  v_existing text;
  v_animal_id uuid;
  v_municipal_id text;
  v_photo jsonb;
  v_line uuid;
  v_phone text;
begin
  select line_id, phone_normalized into v_line, v_phone
  from public.registration_sessions
  where id = p_session_id;

  if v_line is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_line::text || ':' || v_phone));

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
    municipal_id := coalesce(v_session.payload ->> 'completedMunicipalId', '');
    already_done := true;
    return next;
    return;
  end if;

  select c.animal_id, c.municipal_id
  into v_animal_id, v_municipal_id
  from public.complete_animal_registration(
    v_session.org_id,
    p_citizen_id,
    p_payload ->> 'animalName',
    p_payload ->> 'species',
    p_payload ->> 'sex',
    p_payload ->> 'breedColor',
    p_payload ->> 'size',
    p_payload ->> 'ageStage',
    p_payload ->> 'sterilized',
    p_payload ->> 'rabiesStatus',
    p_payload ->> 'microchip',
    nullif(p_payload ->> 'latitude', '')::numeric,
    nullif(p_payload ->> 'longitude', '')::numeric,
    p_payload ->> 'neighborhood'
  ) as c;

  for v_photo in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb))
  loop
    insert into public.animal_photos (
      org_id, animal_id, kind, storage_path, message_id
    ) values (
      v_session.org_id,
      v_animal_id,
      coalesce(v_photo ->> 'kind', 'animal'),
      v_photo ->> 'storage_path',
      nullif(v_photo ->> 'message_id', '')::uuid
    );
  end loop;

  update public.registration_sessions
  set
    step = 'done',
    payload = coalesce(p_payload, v_session.payload) || jsonb_build_object(
      'completedAnimalId', v_animal_id::text,
      'completedMunicipalId', v_municipal_id,
      'citizenId', p_citizen_id::text
    ),
    lock_version = lock_version + 1,
    processing_owner = null,
    processing_until = null
  where id = p_session_id;

  animal_id := v_animal_id;
  municipal_id := v_municipal_id;
  already_done := false;
  return next;
end;
$$;
