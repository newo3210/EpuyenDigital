-- finalize_registration_completion - one transaction: lock session, insert animal once, link photos, mark done
-- Also: advisory-locked session upsert so concurrent process_inbound cannot lost-update the same phone.

alter table public.registration_sessions
  add column if not exists lock_version int not null default 0;

-- upsert_registration_session - advisory xact lock + insert/update for one phone
create or replace function public.upsert_registration_session(
  p_id uuid,
  p_org_id uuid,
  p_line_id uuid,
  p_phone text,
  p_step text,
  p_payload jsonb,
  p_expires_at timestamptz
)
returns public.registration_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.registration_sessions;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_line_id::text || ':' || p_phone)
  );

  select * into v_row
  from public.registration_sessions
  where line_id = p_line_id and phone_normalized = p_phone
  for update;

  if found then
    update public.registration_sessions
    set
      step = p_step,
      payload = p_payload,
      expires_at = p_expires_at,
      lock_version = lock_version + 1
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.registration_sessions (
      id, org_id, line_id, phone_normalized, step, payload, expires_at
    ) values (
      coalesce(p_id, gen_random_uuid()),
      p_org_id, p_line_id, p_phone, p_step, p_payload, p_expires_at
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_registration_session(
  uuid, uuid, uuid, text, text, jsonb, timestamptz
) from public;
grant execute on function public.upsert_registration_session(
  uuid, uuid, uuid, text, text, jsonb, timestamptz
) to service_role;

-- finalize_registration_completion - atomic completion under session FOR UPDATE
-- p_photos: jsonb array of { "kind": "animal"|"health_card", "storage_path": "...", "message_id": "..." }
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
begin
  select * into v_session
  from public.registration_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_session.line_id::text || ':' || v_session.phone_normalized)
  );

  v_existing := v_session.payload ->> 'completedAnimalId';
  if v_existing is not null and length(v_existing) > 0 then
    animal_id := v_existing::uuid;
    municipal_id := coalesce(
      v_session.payload ->> 'completedMunicipalId',
      ''
    );
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
    lock_version = lock_version + 1
  where id = p_session_id;

  animal_id := v_animal_id;
  municipal_id := v_municipal_id;
  already_done := false;
  return next;
end;
$$;

revoke all on function public.finalize_registration_completion(
  uuid, uuid, jsonb, jsonb
) from public;
grant execute on function public.finalize_registration_completion(
  uuid, uuid, jsonb, jsonb
) to service_role;

-- Replace lock helper: advisory lock + FOR UPDATE (still one-shot; prefer upsert/finalize RPCs)
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
  perform pg_advisory_xact_lock(hashtext(p_line_id::text || ':' || p_phone));
  return query
  select s.*
  from public.registration_sessions s
  where s.line_id = p_line_id
    and s.phone_normalized = p_phone
  for update;
end;
$$;
