-- Pobladores ficha: profile fields, manual-source guard, search, and merge.
-- Notes and tasks tables are Phase 5 and are not created here.

-- ---------------------------------------------------------------------------
-- Profile columns
-- ---------------------------------------------------------------------------
alter table public.citizens
  add column if not exists email text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists observations text,
  add column if not exists field_sources jsonb not null default '{}'::jsonb,
  add column if not exists merged_into_id uuid references public.citizens (id),
  add column if not exists registered_at timestamptz,
  add column if not exists registered_by uuid references public.profiles (id);

create unique index if not exists citizens_org_document_active_uidx
  on public.citizens (org_id, document_id)
  where document_id is not null and merged_into_id is null;

create extension if not exists pg_trgm with schema extensions;

create index if not exists citizens_full_name_trgm
  on public.citizens using gin (full_name extensions.gin_trgm_ops);
create index if not exists citizens_document_trgm
  on public.citizens using gin (document_id extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Manual source wins unless the operator function set the session flag
-- ---------------------------------------------------------------------------
create or replace function public.citizens_guard_manual_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sources jsonb := coalesce(old.field_sources, '{}'::jsonb);
  writing text := coalesce(current_setting('app.citizen_field_write', true), '');
begin
  if writing = 'operator' then
    return new;
  end if;

  if sources ->> 'full_name' = 'manual' then new.full_name := old.full_name; end if;
  if sources ->> 'document_id' = 'manual' then new.document_id := old.document_id; end if;
  if sources ->> 'address_line' = 'manual' then new.address_line := old.address_line; end if;
  if sources ->> 'neighborhood' = 'manual' then new.neighborhood := old.neighborhood; end if;
  if sources ->> 'email' = 'manual' then new.email := old.email; end if;
  if sources ->> 'latitude' = 'manual' then new.latitude := old.latitude; end if;
  if sources ->> 'longitude' = 'manual' then new.longitude := old.longitude; end if;
  if sources ->> 'tags' = 'manual' then new.tags := old.tags; end if;
  if sources ->> 'observations' = 'manual' then new.observations := old.observations; end if;
  if sources ->> 'party_kind' = 'manual' then new.party_kind := old.party_kind; end if;

  new.field_sources := coalesce(new.field_sources, '{}'::jsonb) || sources;
  return new;
end;
$$;

drop trigger if exists citizens_guard_manual_fields on public.citizens;
create trigger citizens_guard_manual_fields
  before update on public.citizens
  for each row execute function public.citizens_guard_manual_fields();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.citizen_visible(p_id uuid)
returns public.citizens
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.citizens;
begin
  if auth.uid() is null then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  select * into row from public.citizens where id = p_id;
  if not found or row.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  return row;
end;
$$;

create or replace function public.citizen_assert_editor()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  role public.user_role;
begin
  if uid is null then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  role := public.current_user_role();
  if role is null or role = 'support' then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  return uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile update
-- ---------------------------------------------------------------------------
create or replace function public.update_citizen_profile(
  p_id uuid,
  p_full_name text,
  p_document_id text,
  p_address_line text,
  p_neighborhood text,
  p_email text,
  p_tags text[],
  p_observations text,
  p_party_kind text,
  p_latitude numeric,
  p_longitude numeric
)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.citizens;
  uid uuid;
  sources jsonb;
  kind text := regexp_replace(coalesce(p_party_kind, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  uid := public.citizen_assert_editor();
  row := public.citizen_visible(p_id);
  if row.merged_into_id is not null then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if kind not in ('person', 'organization') then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    perform public.inbox_raise('INVALID_FIELD');
  end if;

  perform set_config('app.citizen_field_write', 'operator', true);
  sources := coalesce(row.field_sources, '{}'::jsonb);

  -- A blank the operator never set stays fillable. A value they saved, or a manual field they cleared, stays manual.
  if nullif(regexp_replace(coalesce(p_full_name, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
     or sources ->> 'full_name' = 'manual' then
    sources := sources || '{"full_name":"manual"}'::jsonb;
  end if;
  if nullif(regexp_replace(coalesce(p_document_id, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
     or sources ->> 'document_id' = 'manual' then
    sources := sources || '{"document_id":"manual"}'::jsonb;
  end if;
  if nullif(regexp_replace(coalesce(p_address_line, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
     or sources ->> 'address_line' = 'manual' then
    sources := sources || '{"address_line":"manual"}'::jsonb;
  end if;
  if nullif(regexp_replace(coalesce(p_neighborhood, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
     or sources ->> 'neighborhood' = 'manual' then
    sources := sources || '{"neighborhood":"manual"}'::jsonb;
  end if;
  if nullif(regexp_replace(coalesce(p_email, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
     or sources ->> 'email' = 'manual' then
    sources := sources || '{"email":"manual"}'::jsonb;
  end if;
  if p_latitude is not null or sources ->> 'latitude' = 'manual' then
    sources := sources || '{"latitude":"manual"}'::jsonb;
  end if;
  if p_longitude is not null or sources ->> 'longitude' = 'manual' then
    sources := sources || '{"longitude":"manual"}'::jsonb;
  end if;
  if coalesce(cardinality(p_tags), 0) > 0 or sources ->> 'tags' = 'manual' then
    sources := sources || '{"tags":"manual"}'::jsonb;
  end if;
  if nullif(regexp_replace(coalesce(p_observations, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), '') is not null
     or sources ->> 'observations' = 'manual' then
    sources := sources || '{"observations":"manual"}'::jsonb;
  end if;
  sources := sources || '{"party_kind":"manual"}'::jsonb;

  update public.citizens c
  set full_name = nullif(regexp_replace(coalesce(p_full_name, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
      document_id = nullif(regexp_replace(coalesce(p_document_id, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
      address_line = nullif(regexp_replace(coalesce(p_address_line, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
      neighborhood = nullif(regexp_replace(coalesce(p_neighborhood, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
      email = nullif(regexp_replace(coalesce(p_email, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
      tags = coalesce(p_tags, '{}'::text[]),
      observations = nullif(regexp_replace(coalesce(p_observations, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
      party_kind = kind,
      latitude = p_latitude,
      longitude = p_longitude,
      field_sources = sources
  where c.id = row.id;

  result_id := row.id;
  result_hint := 'ok';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Register
-- ---------------------------------------------------------------------------
create or replace function public.register_citizen(p_id uuid)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.citizens;
  uid uuid;
  has_phone boolean;
begin
  uid := public.citizen_assert_editor();
  row := public.citizen_visible(p_id);
  if row.merged_into_id is not null then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if row.registration_status = 'registered' then
    perform public.inbox_raise('ALREADY_REGISTERED');
  end if;

  select exists (
    select 1 from public.citizen_phones p where p.citizen_id = row.id
  ) into has_phone;

  if nullif(btrim(coalesce(row.full_name, '')), '') is null or not has_phone then
    perform public.inbox_raise('MISSING_FIELDS');
  end if;
  if row.party_kind is distinct from 'organization'
    and nullif(btrim(coalesce(row.document_id, '')), '') is null then
    perform public.inbox_raise('MISSING_FIELDS');
  end if;

  update public.citizens c
  set registration_status = 'registered',
      registered_at = now(),
      registered_by = uid
  where c.id = row.id;

  result_id := row.id;
  result_hint := 'ok';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------
create or replace function public.search_citizens(p_query text)
returns table (
  result_id uuid,
  result_full_name text,
  result_document_id text,
  result_phone text,
  result_registration_status text,
  result_party_kind text,
  result_push_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  raw text := regexp_replace(coalesce(p_query, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  q text;
begin
  if auth.uid() is null or public.current_org_id() is null then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  if raw = '' then
    return;
  end if;
  q := replace(replace(replace(raw, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select
    c.id,
    c.full_name,
    c.document_id,
    (select p.phone_normalized from public.citizen_phones p where p.citizen_id = c.id order by p.phone_normalized limit 1),
    c.registration_status,
    c.party_kind,
    c.whatsapp_push_name
  from public.citizens c
  where c.org_id = public.current_org_id()
    and c.merged_into_id is null
    and (
      c.full_name ilike '%' || q || '%' escape '\'
      or c.document_id ilike '%' || q || '%' escape '\'
      or exists (
        select 1 from public.citizen_phones p
        where p.citizen_id = c.id
          and p.phone_normalized ilike '%' || q || '%' escape '\'
      )
    )
  order by c.full_name nulls last, c.id
  limit 20;
end;
$$;

-- ---------------------------------------------------------------------------
-- Merge
-- ---------------------------------------------------------------------------
create or replace function public.merge_citizens(p_keep uuid, p_drop uuid, p_note text)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  keep_row public.citizens;
  drop_row public.citizens;
  note text := regexp_replace(coalesce(p_note, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  perform public.citizen_assert_editor();
  if p_keep = p_drop then
    perform public.inbox_raise('MERGE_SELF');
  end if;
  if note = '' then
    perform public.inbox_raise('NOTE_REQUIRED');
  end if;
  keep_row := public.citizen_visible(p_keep);
  drop_row := public.citizen_visible(p_drop);
  if keep_row.merged_into_id is not null or drop_row.merged_into_id is not null then
    perform public.inbox_raise('NOT_FOUND');
  end if;

  delete from public.citizen_phones d
  using public.citizen_phones k
  where d.citizen_id = drop_row.id
    and k.citizen_id = keep_row.id
    and d.phone_normalized = k.phone_normalized
    and d.org_id = k.org_id;

  update public.citizen_phones set citizen_id = keep_row.id where citizen_id = drop_row.id;
  update public.conversations set citizen_id = keep_row.id where citizen_id = drop_row.id;
  update public.animals set citizen_id = keep_row.id where citizen_id = drop_row.id;

  perform set_config('app.citizen_field_write', 'operator', true);
  update public.citizens
  set merged_into_id = keep_row.id,
      observations = concat_ws(E'\n', observations, note)
  where id = drop_row.id;

  result_id := keep_row.id;
  result_hint := 'ok';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads for the ficha. Mutations stay on the functions above.
-- ---------------------------------------------------------------------------
drop policy if exists citizens_select_org on public.citizens;
create policy citizens_select_org on public.citizens
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists citizen_phones_select_org on public.citizen_phones;
create policy citizen_phones_select_org on public.citizen_phones
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists animals_select_org on public.animals;
create policy animals_select_org on public.animals
  for select to authenticated
  using (org_id = public.current_org_id());

revoke insert, update, delete on public.citizens from public, anon, authenticated;
revoke insert, update, delete on public.citizen_phones from public, anon, authenticated;
revoke insert, update, delete on public.animals from public, anon, authenticated;
grant select on public.citizens to authenticated;
grant select on public.citizen_phones to authenticated;
grant select on public.animals to authenticated;

revoke all on function public.citizens_guard_manual_fields() from public, anon, authenticated;
revoke all on function public.citizen_visible(uuid) from public, anon, authenticated;
revoke all on function public.citizen_assert_editor() from public, anon, authenticated;

revoke all on function public.update_citizen_profile(uuid, text, text, text, text, text, text[], text, text, numeric, numeric) from public, anon;
revoke all on function public.register_citizen(uuid) from public, anon;
revoke all on function public.search_citizens(text) from public, anon;
revoke all on function public.merge_citizens(uuid, uuid, text) from public, anon;

grant execute on function public.update_citizen_profile(uuid, text, text, text, text, text, text[], text, text, numeric, numeric) to authenticated, service_role;
grant execute on function public.register_citizen(uuid) to authenticated, service_role;
grant execute on function public.search_citizens(text) to authenticated, service_role;
grant execute on function public.merge_citizens(uuid, uuid, text) to authenticated, service_role;
