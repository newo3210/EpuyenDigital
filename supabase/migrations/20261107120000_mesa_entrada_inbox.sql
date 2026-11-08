-- Mesa de entrada inbox: ownership transitions, area reads, SLA clock, queue.
-- Pet process_inbound is intentionally unchanged.

-- ---------------------------------------------------------------------------
-- Business calendar
-- ---------------------------------------------------------------------------
create or replace function public.default_business_hours()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"mon":[["08:00","14:00"]],"tue":[["08:00","14:00"]],"wed":[["08:00","14:00"]],"thu":[["08:00","14:00"]],"fri":[["08:00","14:00"]],"sat":[],"sun":[]}'::jsonb
$$;

alter table public.org_settings
  add column if not exists business_hours jsonb not null default public.default_business_hours(),
  add column if not exists holidays date[] not null default '{}';

alter table public.conversations
  add column if not exists last_message_preview text,
  add column if not exists last_message_kind text,
  add column if not exists has_attachments boolean not null default false;

-- ---------------------------------------------------------------------------
-- Events, reads, quick replies
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'QUEUED', 'CLAIMED', 'MOVED', 'DELEGATED', 'ACCEPTED', 'REJECTED',
      'RESOLVED', 'REOPENED', 'BOT_PAUSED', 'BOT_RESUMED', 'AREA_CHANGED'
    )),
  actor_kind text not null check (actor_kind in ('operator', 'bot', 'system', 'external')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  from_column text,
  to_column text,
  from_area_id uuid,
  to_area_id uuid,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversation_events_conversation_idx
  on public.conversation_events (conversation_id, created_at);

create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  last_read_message_id uuid,
  primary key (conversation_id, user_id)
);

create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  area_id uuid references public.areas (id) on delete cascade,
  shortcut text not null,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quick_replies_shortcut_idx
  on public.quick_replies (org_id, coalesce(area_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(shortcut));

drop trigger if exists quick_replies_set_updated_at on public.quick_replies;
create trigger quick_replies_set_updated_at
  before update on public.quick_replies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SLA clock
-- ---------------------------------------------------------------------------
create or replace function public.add_business_minutes(
  p_start timestamptz,
  p_minutes integer,
  p_hours jsonb,
  p_holidays date[],
  p_tz text
) returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  remaining integer := p_minutes;
  cursor_ts timestamptz := p_start;
  local_ts timestamp;
  v_date date;
  v_minutes integer;
  v_dow integer;
  v_key text;
  v_windows jsonb;
  rec record;
  v_open integer;
  v_close integer;
  v_found boolean;
  v_available integer;
  guard integer := 0;
  hours jsonb := coalesce(p_hours, public.default_business_hours());
  holidays date[] := coalesce(p_holidays, '{}'::date[]);
  tz text := coalesce(nullif(p_tz, ''), 'America/Argentina/Buenos_Aires');
begin
  if p_minutes is null then
    return null;
  end if;
  if p_minutes <= 0 then
    return p_start;
  end if;

  while remaining > 0 loop
    guard := guard + 1;
    if guard > 500 then
      raise exception 'business_minutes_overflow' using errcode = 'P0001';
    end if;

    local_ts := cursor_ts at time zone tz;
    v_date := local_ts::date;
    v_minutes := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
    v_dow := extract(dow from local_ts)::int;
    v_key := case v_dow
      when 0 then 'sun' when 1 then 'mon' when 2 then 'tue' when 3 then 'wed'
      when 4 then 'thu' when 5 then 'fri' else 'sat' end;

    if v_date = any (holidays) then
      v_windows := '[]'::jsonb;
    else
      v_windows := hours -> v_key;
    end if;

    if v_windows is null or jsonb_typeof(v_windows) <> 'array' or jsonb_array_length(v_windows) = 0 then
      cursor_ts := ((v_date + 1)::timestamp at time zone tz);
      continue;
    end if;

    v_found := false;
    v_open := 0;
    v_close := 0;
    for rec in select value from jsonb_array_elements(v_windows) as t(value) loop
      v_open := split_part(rec.value ->> 0, ':', 1)::int * 60 + split_part(rec.value ->> 0, ':', 2)::int;
      v_close := split_part(rec.value ->> 1, ':', 1)::int * 60 + split_part(rec.value ->> 1, ':', 2)::int;
      if v_minutes < v_close then
        v_found := true;
        exit;
      end if;
    end loop;

    if not v_found then
      cursor_ts := ((v_date + 1)::timestamp at time zone tz);
      continue;
    end if;

    if v_minutes < v_open then
      cursor_ts := ((v_date::timestamp + make_interval(mins => v_open)) at time zone tz);
      continue;
    end if;

    v_available := v_close - v_minutes;
    if remaining <= v_available then
      return (v_date::timestamp + make_interval(mins => v_minutes + remaining)) at time zone tz;
    end if;

    remaining := remaining - v_available;
    cursor_ts := ((v_date::timestamp + make_interval(mins => v_close)) at time zone tz);
  end loop;

  return cursor_ts;
end;
$$;

create or replace function public.business_minutes_between(
  p_start timestamptz,
  p_end timestamptz,
  p_hours jsonb,
  p_holidays date[],
  p_tz text
) returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  total integer := 0;
  cursor_ts timestamptz := p_start;
  local_ts timestamp;
  end_local timestamp;
  v_date date;
  end_date date;
  v_minutes integer;
  end_minutes integer;
  v_dow integer;
  v_key text;
  v_windows jsonb;
  rec record;
  v_open integer;
  v_close integer;
  v_found boolean;
  v_cap integer;
  guard integer := 0;
  hours jsonb := coalesce(p_hours, public.default_business_hours());
  holidays date[] := coalesce(p_holidays, '{}'::date[]);
  tz text := coalesce(nullif(p_tz, ''), 'America/Argentina/Buenos_Aires');
begin
  if p_start is null or p_end is null or p_end <= p_start then
    return 0;
  end if;

  while cursor_ts < p_end loop
    guard := guard + 1;
    if guard > 500 then
      return total;
    end if;

    local_ts := cursor_ts at time zone tz;
    end_local := p_end at time zone tz;
    v_date := local_ts::date;
    end_date := end_local::date;
    v_minutes := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
    end_minutes := extract(hour from end_local)::int * 60 + extract(minute from end_local)::int;
    v_dow := extract(dow from local_ts)::int;
    v_key := case v_dow
      when 0 then 'sun' when 1 then 'mon' when 2 then 'tue' when 3 then 'wed'
      when 4 then 'thu' when 5 then 'fri' else 'sat' end;

    if v_date = any (holidays) then
      v_windows := '[]'::jsonb;
    else
      v_windows := hours -> v_key;
    end if;

    if v_windows is null or jsonb_typeof(v_windows) <> 'array' or jsonb_array_length(v_windows) = 0 then
      cursor_ts := ((v_date + 1)::timestamp at time zone tz);
      continue;
    end if;

    v_found := false;
    for rec in select value from jsonb_array_elements(v_windows) as t(value) loop
      v_open := split_part(rec.value ->> 0, ':', 1)::int * 60 + split_part(rec.value ->> 0, ':', 2)::int;
      v_close := split_part(rec.value ->> 1, ':', 1)::int * 60 + split_part(rec.value ->> 1, ':', 2)::int;
      if v_minutes < v_close then
        v_found := true;
        exit;
      end if;
    end loop;

    if not v_found then
      cursor_ts := ((v_date + 1)::timestamp at time zone tz);
      continue;
    end if;

    if v_minutes < v_open then
      cursor_ts := ((v_date::timestamp + make_interval(mins => v_open)) at time zone tz);
      continue;
    end if;

    if v_date = end_date then
      v_cap := least(v_close, end_minutes);
    else
      v_cap := v_close;
    end if;

    if v_cap <= v_minutes then
      cursor_ts := ((v_date + 1)::timestamp at time zone tz);
      continue;
    end if;

    total := total + (v_cap - v_minutes);
    if v_date = end_date and end_minutes <= v_close then
      return total;
    end if;
    cursor_ts := ((v_date::timestamp + make_interval(mins => v_cap)) at time zone tz);
  end loop;

  return total;
end;
$$;

create or replace function public.conversations_sync_sla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  critical integer;
  hours jsonb;
  holidays date[];
  tz text;
begin
  if new.needs_response and new.last_inbound_at is not null then
    select a.sla_critical_minutes into critical
    from public.areas a
    where a.id = new.area_id;
    if critical is null then
      new.sla_due_at := null;
    else
      select o.timezone into tz from public.organizations o where o.id = new.org_id;
      select s.business_hours, s.holidays into hours, holidays
      from public.org_settings s
      where s.org_id = new.org_id;
      new.sla_due_at := public.add_business_minutes(
        new.last_inbound_at, critical, hours, holidays, tz
      );
    end if;
  else
    new.sla_due_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_sync_sla on public.conversations;
create trigger conversations_sync_sla
  before insert or update on public.conversations
  for each row execute function public.conversations_sync_sla();

-- Area or calendar edits recompute due times. A conversation update runs the SLA trigger.
create or replace function public.areas_refresh_conversation_sla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sla_critical_minutes is distinct from old.sla_critical_minutes
    or new.sla_warning_minutes is distinct from old.sla_warning_minutes then
    update public.conversations c
    set updated_at = now()
    where c.area_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists areas_refresh_conversation_sla on public.areas;
create trigger areas_refresh_conversation_sla
  after update of sla_warning_minutes, sla_critical_minutes on public.areas
  for each row execute function public.areas_refresh_conversation_sla();

create or replace function public.org_settings_refresh_conversation_sla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.business_hours is distinct from old.business_hours
    or new.holidays is distinct from old.holidays then
    update public.conversations c
    set updated_at = now()
    where c.org_id = new.org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists org_settings_refresh_conversation_sla on public.org_settings;
create trigger org_settings_refresh_conversation_sla
  after update of business_hours, holidays on public.org_settings
  for each row execute function public.org_settings_refresh_conversation_sla();

-- ---------------------------------------------------------------------------
-- Transition helpers
-- ---------------------------------------------------------------------------
create or replace function public.inbox_raise(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_code
    using errcode = 'P0001', hint = p_code, detail = p_detail;
end;
$$;

create or replace function public.profile_display_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name from public.profiles p where p.id = p_id
$$;

create or replace function public.conversation_visible_to_caller(conv public.conversations)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  role public.user_role;
begin
  if uid is null then
    return false;
  end if;
  if conv.org_id is distinct from public.current_org_id() then
    return false;
  end if;
  role := public.current_user_role();
  if role in ('admin', 'support') then
    return true;
  end if;
  if role is null then
    return false;
  end if;
  return conv.area_id in (select public.current_area_ids())
    or conv.pending_area_id in (select public.current_area_ids())
    or conv.owner_user_id = uid
    or conv.delegated_from_user_id = uid;
end;
$$;

create or replace function public.inbox_lock_conversation(p_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
begin
  select * into conv from public.conversations where id = p_id for update;
  if not found then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  return conv;
end;
$$;

create or replace function public.inbox_assert_operator(conv public.conversations)
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
  if not public.conversation_visible_to_caller(conv) then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  return uid;
end;
$$;

create or replace function public.inbox_event(
  conv public.conversations,
  p_type text,
  p_actor uuid,
  p_from_column text,
  p_to_column text,
  p_from_area uuid,
  p_to_area uuid,
  p_note text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversation_events (
    org_id, conversation_id, event_type, actor_kind, actor_user_id,
    from_column, to_column, from_area_id, to_area_id, note, metadata
  ) values (
    conv.org_id,
    conv.id,
    p_type,
    case when p_actor is null then 'system' else 'operator' end,
    p_actor,
    p_from_column,
    p_to_column,
    p_from_area,
    p_to_area,
    p_note,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Transitions
-- ---------------------------------------------------------------------------
create or replace function public.accept_conversation_delegation(p_conversation_id uuid)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if not conv.awaiting_acceptance then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;
  if not (
    conv.owner_user_id = uid
    or (conv.owner_user_id is null and conv.pending_area_id in (select public.current_area_ids()))
  ) then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;

  update public.conversations c
  set owner_user_id = uid,
      awaiting_acceptance = false,
      pending_area_id = null,
      delegated_from_user_id = null,
      queue_column = 'claimed',
      bot_state = 'paused'
  where c.id = conv.id;

  perform public.inbox_event(conv, 'ACCEPTED', uid, conv.queue_column, 'claimed', conv.area_id, conv.area_id, null, '{}');
  perform public.inbox_event(conv, 'BOT_PAUSED', uid, null, null, null, null, null, '{}');

  result_conversation_id := conv.id;
  result_owner_user_id := uid;
  result_owner_name := public.profile_display_name(uid);
  result_queue_column := 'claimed';
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.claim_conversation(p_conversation_id uuid)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if conv.queue_column = 'resolved' then
    perform public.inbox_raise('CLAIM_CONFLICT', public.profile_display_name(conv.owner_user_id));
  end if;
  if conv.awaiting_acceptance
    and conv.owner_user_id is null
    and conv.pending_area_id in (select public.current_area_ids()) then
    return query select * from public.accept_conversation_delegation(p_conversation_id);
    return;
  end if;
  if conv.owner_user_id is not null then
    perform public.inbox_raise('CLAIM_CONFLICT', public.profile_display_name(conv.owner_user_id));
  end if;

  update public.conversations c
  set owner_user_id = uid,
      queue_column = 'claimed',
      bot_state = 'paused',
      awaiting_acceptance = false,
      pending_area_id = null,
      delegated_from_user_id = null
  where c.id = conv.id;

  perform public.inbox_event(conv, 'CLAIMED', uid, conv.queue_column, 'claimed', null, null, null, '{}');
  perform public.inbox_event(conv, 'BOT_PAUSED', uid, null, null, null, null, null, '{}');

  result_conversation_id := conv.id;
  result_owner_user_id := uid;
  result_owner_name := public.profile_display_name(uid);
  result_queue_column := 'claimed';
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.ensure_owner_for_reply(p_conversation_id uuid)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);

  if conv.awaiting_acceptance and (
    conv.owner_user_id = uid
    or (conv.owner_user_id is null and conv.pending_area_id in (select public.current_area_ids()))
  ) then
    return query select * from public.accept_conversation_delegation(p_conversation_id);
    return;
  end if;

  if conv.owner_user_id is null and conv.queue_column <> 'resolved' then
    return query select * from public.claim_conversation(p_conversation_id);
    return;
  end if;

  if conv.owner_user_id = uid and not conv.awaiting_acceptance then
    result_conversation_id := conv.id;
    result_owner_user_id := uid;
    result_owner_name := public.profile_display_name(uid);
    result_queue_column := conv.queue_column;
    result_hint := 'ok';
    return next;
    return;
  end if;

  if conv.owner_user_id is not null and conv.owner_user_id <> uid then
    perform public.inbox_raise('NOT_OWNER', public.profile_display_name(conv.owner_user_id));
  end if;

  perform public.inbox_raise('FORBIDDEN');
end;
$$;

create or replace function public.delegate_conversation(
  p_conversation_id uuid,
  p_target_user uuid,
  p_target_area uuid,
  p_note text
)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
  note text := regexp_replace(coalesce(p_note, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if conv.owner_user_id is distinct from uid then
    perform public.inbox_raise('NOT_OWNER');
  end if;
  if note = '' then
    perform public.inbox_raise('NOTE_REQUIRED');
  end if;
  if (p_target_user is null) = (p_target_area is null) then
    perform public.inbox_raise('INVALID_TARGET');
  end if;

  if p_target_user is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_target_user and p.org_id = conv.org_id and p.is_active and p.role <> 'support'
    ) then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
    update public.conversations c
    set owner_user_id = p_target_user,
        delegated_from_user_id = uid,
        pending_area_id = null,
        awaiting_acceptance = true
    where c.id = conv.id;
  else
    if not exists (
      select 1 from public.areas a
      where a.id = p_target_area and a.org_id = conv.org_id and a.is_active
    ) then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
    update public.conversations c
    set owner_user_id = null,
        delegated_from_user_id = uid,
        pending_area_id = p_target_area,
        awaiting_acceptance = true
    where c.id = conv.id;
  end if;

  perform public.inbox_event(conv, 'DELEGATED', uid, conv.queue_column, conv.queue_column, conv.area_id, p_target_area, note, '{}');

  result_conversation_id := conv.id;
  result_owner_user_id := p_target_user;
  result_owner_name := public.profile_display_name(coalesce(p_target_user, uid));
  result_queue_column := conv.queue_column;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.reject_conversation_delegation(
  p_conversation_id uuid,
  p_note text
)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
  note text := regexp_replace(coalesce(p_note, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  allowed boolean := false;
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if note = '' then
    perform public.inbox_raise('NOTE_REQUIRED');
  end if;
  if not conv.awaiting_acceptance or conv.delegated_from_user_id is null then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;

  if conv.owner_user_id = uid then
    allowed := true;
  elsif conv.owner_user_id is null and conv.pending_area_id is not null and public.current_user_role() = 'area_lead'
    and conv.pending_area_id in (select public.current_area_ids()) then
    allowed := true;
  end if;
  if not allowed then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;

  update public.conversations c
  set owner_user_id = conv.delegated_from_user_id,
      awaiting_acceptance = false,
      pending_area_id = null,
      delegated_from_user_id = null
  where c.id = conv.id;

  perform public.inbox_event(conv, 'REJECTED', uid, conv.queue_column, conv.queue_column, null, null, note, '{}');

  result_conversation_id := conv.id;
  result_owner_user_id := conv.delegated_from_user_id;
  result_owner_name := public.profile_display_name(conv.delegated_from_user_id);
  result_queue_column := conv.queue_column;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.move_conversation(p_conversation_id uuid, p_column text)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if conv.owner_user_id is distinct from uid and public.current_user_role() <> 'admin' then
    perform public.inbox_raise('NOT_OWNER');
  end if;
  if conv.queue_column = 'resolved' or p_column not in ('claimed', 'in_progress', 'waiting_external') then
    perform public.inbox_raise('INVALID_COLUMN');
  end if;

  update public.conversations c set queue_column = p_column where c.id = conv.id;
  perform public.inbox_event(conv, 'MOVED', uid, conv.queue_column, p_column, null, null, null, '{}');

  result_conversation_id := conv.id;
  result_owner_user_id := conv.owner_user_id;
  result_owner_name := public.profile_display_name(conv.owner_user_id);
  result_queue_column := p_column;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.resolve_conversation(p_conversation_id uuid)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if conv.owner_user_id is distinct from uid and public.current_user_role() <> 'admin' then
    perform public.inbox_raise('NOT_OWNER');
  end if;

  update public.conversations c
  set queue_column = 'resolved',
      resolved_at = now(),
      resolved_by = uid,
      bot_state = 'active',
      awaiting_acceptance = false,
      pending_area_id = null,
      delegated_from_user_id = null
  where c.id = conv.id;

  perform public.inbox_event(conv, 'RESOLVED', uid, conv.queue_column, 'resolved', null, null, null, '{}');
  perform public.inbox_event(conv, 'BOT_RESUMED', uid, null, null, null, null, null, '{}');

  result_conversation_id := conv.id;
  result_owner_user_id := conv.owner_user_id;
  result_owner_name := public.profile_display_name(uid);
  result_queue_column := 'resolved';
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.set_conversation_area(p_conversation_id uuid, p_area_id uuid)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid;
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if conv.owner_user_id is distinct from uid and public.current_user_role() <> 'admin' then
    perform public.inbox_raise('NOT_OWNER');
  end if;
  if not exists (
    select 1 from public.areas a
    where a.id = p_area_id and a.org_id = conv.org_id and a.is_active
  ) then
    perform public.inbox_raise('INVALID_AREA');
  end if;

  update public.conversations c set area_id = p_area_id where c.id = conv.id;
  perform public.inbox_event(conv, 'AREA_CHANGED', uid, null, null, conv.area_id, p_area_id, null, '{}');

  result_conversation_id := conv.id;
  result_owner_user_id := conv.owner_user_id;
  result_owner_name := public.profile_display_name(uid);
  result_queue_column := conv.queue_column;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.reopen_conversation(
  p_conversation_id uuid,
  p_at timestamptz,
  p_message_id uuid
)
returns table (
  result_conversation_id uuid,
  result_owner_user_id uuid,
  result_owner_name text,
  result_queue_column text,
  result_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  jwt_role text := coalesce(auth.role(), '');
begin
  if jwt_role is distinct from 'service_role' then
    perform public.inbox_raise('FORBIDDEN');
  end if;

  conv := public.inbox_lock_conversation(p_conversation_id);
  if conv.queue_column <> 'resolved' or exists (
    select 1 from public.conversation_events e
    where e.conversation_id = conv.id
      and e.event_type = 'REOPENED'
      and e.metadata ->> 'message_id' = p_message_id::text
  ) or exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and conv.resolved_at is not null
      and m.created_at < conv.resolved_at
  ) then
    result_conversation_id := conv.id;
    result_owner_user_id := conv.owner_user_id;
    result_owner_name := public.profile_display_name(conv.owner_user_id);
    result_queue_column := conv.queue_column;
    result_hint := 'noop';
    return next;
    return;
  end if;

  update public.conversations c
  set queue_column = 'new',
      owner_user_id = null,
      awaiting_acceptance = false,
      pending_area_id = null,
      delegated_from_user_id = null,
      entered_queue_at = coalesce(p_at, now()),
      bot_state = 'active',
      resolved_at = null,
      resolved_by = null
  where c.id = conv.id;

  perform public.inbox_event(
    conv, 'REOPENED', null, 'resolved', 'new', null, null, null,
    jsonb_build_object('message_id', p_message_id)
  );

  result_conversation_id := conv.id;
  result_owner_user_id := null;
  result_owner_name := null;
  result_queue_column := 'new';
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  uid uuid := auth.uid();
  latest uuid;
begin
  if uid is null or not exists (select 1 from public.conversations c where c.id = p_conversation_id) then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  select * into conv from public.conversations where id = p_conversation_id;
  if not public.conversation_visible_to_caller(conv) then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  select m.id into latest
  from public.messages m
  where m.conversation_id = p_conversation_id
  order by m.created_at desc
  limit 1;

  insert into public.conversation_reads (conversation_id, user_id, last_read_at, last_read_message_id)
  values (p_conversation_id, uid, now(), latest)
  on conflict (conversation_id, user_id) do update
    set last_read_at = now(),
        last_read_message_id = excluded.last_read_message_id;
end;
$$;

create or replace function public.set_business_calendar(p_hours jsonb, p_holidays date[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid := public.current_org_id();
begin
  if public.current_user_role() is distinct from 'admin' or org is null then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  if p_hours is null or p_hours -> 'mon' is null or p_hours -> 'fri' is null then
    perform public.inbox_raise('INVALID_TARGET');
  end if;
  update public.org_settings s
  set business_hours = p_hours,
      holidays = coalesce(p_holidays, '{}'::date[])
  where s.org_id = org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue read model
-- ---------------------------------------------------------------------------
create or replace function public.list_inbox_queue(
  p_area_id uuid default null,
  p_line_id uuid default null,
  p_owner text default null,
  p_awaiting_mine boolean default false,
  p_unanswered boolean default false,
  p_with_attachments boolean default false
)
returns table (
  id uuid,
  phone_normalized text,
  area_id uuid,
  area_name text,
  line_id uuid,
  owner_user_id uuid,
  owner_name text,
  queue_column text,
  bot_state text,
  needs_response boolean,
  awaiting_acceptance boolean,
  has_attachments boolean,
  last_message_at timestamptz,
  last_message_preview text,
  last_inbound_at timestamptz,
  entered_queue_at timestamptz,
  sla_level text,
  registration_status text,
  citizen_push_name text,
  unread boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_org_id() is null then
    return;
  end if;

  return query
  select
    c.id,
    c.phone_normalized,
    c.area_id,
    a.name,
    c.line_id,
    c.owner_user_id,
    owner.full_name,
    c.queue_column,
    c.bot_state,
    c.needs_response,
    c.awaiting_acceptance,
    c.has_attachments,
    c.last_message_at,
    c.last_message_preview,
    c.last_inbound_at,
    c.entered_queue_at,
    case
      when a.sla_warning_minutes is null and a.sla_critical_minutes is null then 'hidden'
      when not c.needs_response then 'ok'
      when c.sla_due_at is not null and c.sla_due_at <= now() then 'critical'
      when a.sla_warning_minutes is not null and c.last_inbound_at is not null
        and public.business_minutes_between(
          c.last_inbound_at, now(), s.business_hours, s.holidays, o.timezone
        ) >= a.sla_warning_minutes then 'warning'
      else 'ok'
    end,
    cit.registration_status,
    cit.whatsapp_push_name,
    c.last_inbound_at is not null and not exists (
      select 1 from public.conversation_reads r
      where r.conversation_id = c.id
        and r.user_id = auth.uid()
        and c.last_inbound_at is not null
        and r.last_read_at >= c.last_inbound_at
    )
  from public.conversations c
  join public.areas a on a.id = c.area_id
  join public.organizations o on o.id = c.org_id
  left join public.org_settings s on s.org_id = c.org_id
  left join public.profiles owner on owner.id = c.owner_user_id
  left join public.citizens cit on cit.id = c.citizen_id
  where public.conversation_visible_to_caller(c)
    and c.queue_column <> 'resolved'
    and (p_area_id is null or c.area_id = p_area_id)
    and (p_line_id is null or c.line_id = p_line_id)
    and (
      p_owner is null
      or (p_owner = 'unowned' and c.owner_user_id is null)
      or (p_owner = 'me' and c.owner_user_id = auth.uid())
      or (
        p_owner ~* '^[0-9a-f-]{36}$'
        and c.owner_user_id = p_owner::uuid
      )
    )
    and (
      not coalesce(p_awaiting_mine, false)
      or (
        c.awaiting_acceptance
        and (
          c.owner_user_id = auth.uid()
          or c.pending_area_id in (select public.current_area_ids())
        )
      )
    )
    and (not coalesce(p_unanswered, false) or c.needs_response)
    and (not coalesce(p_with_attachments, false) or c.has_attachments)
  order by
    (c.owner_user_id is null) desc,
    case when c.owner_user_id is null then c.entered_queue_at end asc nulls last,
    case when c.owner_user_id is not null then c.last_inbound_at end desc nulls last,
    c.needs_response desc,
    (c.sla_due_at is not null and c.sla_due_at <= now()) desc,
    c.entered_queue_at asc;
end;
$$;

create or replace function public.inbox_attention_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.list_inbox_queue(null, null, null, false, false, false) q
  where q.unread
    or exists (
      select 1
      from public.conversations c
      where c.id = q.id
        and c.awaiting_acceptance
        and (
          c.owner_user_id = auth.uid()
          or c.pending_area_id in (select public.current_area_ids())
        )
    )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.conversation_events enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.quick_replies enable row level security;

drop policy if exists conversations_select_org on public.conversations;
create policy conversations_select_visible on public.conversations
  for select to authenticated
  using (public.conversation_visible_to_caller(conversations));

drop policy if exists messages_select_org on public.messages;
create policy messages_select_visible on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.conversation_visible_to_caller(c)
    )
  );

drop policy if exists conversation_events_select on public.conversation_events;
create policy conversation_events_select on public.conversation_events
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_events.conversation_id
        and public.conversation_visible_to_caller(c)
    )
  );

drop policy if exists conversation_reads_select_own on public.conversation_reads;
create policy conversation_reads_select_own on public.conversation_reads
  for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_reads.conversation_id
        and public.conversation_visible_to_caller(c)
    )
  );

drop policy if exists conversation_reads_write_own on public.conversation_reads;
create policy conversation_reads_write_own on public.conversation_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_reads.conversation_id
        and public.conversation_visible_to_caller(c)
    )
  );

drop policy if exists conversation_reads_update_own on public.conversation_reads;
create policy conversation_reads_update_own on public.conversation_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists quick_replies_select_org on public.quick_replies;
create policy quick_replies_select_org on public.quick_replies
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists quick_replies_admin_write on public.quick_replies;
create policy quick_replies_admin_insert on public.quick_replies
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

drop policy if exists quick_replies_admin_update on public.quick_replies;
create policy quick_replies_admin_update on public.quick_replies
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  )
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

drop policy if exists org_settings_admin_select on public.org_settings;
create policy org_settings_admin_select on public.org_settings
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

revoke insert, update, delete on public.conversation_events from authenticated, anon;
revoke insert, update, delete on public.conversations from authenticated, anon;
revoke insert, update, delete on public.messages from authenticated, anon;

grant select on public.conversation_events to authenticated;
grant select, insert, update on public.conversation_reads to authenticated;
grant select, insert, update on public.quick_replies to authenticated;
grant select on public.org_settings to authenticated;

-- Execute
revoke all on function public.inbox_raise(text, text) from public, anon, authenticated;
revoke all on function public.profile_display_name(uuid) from public, anon, authenticated;
revoke all on function public.conversation_visible_to_caller(public.conversations) from public, anon;
grant execute on function public.conversation_visible_to_caller(public.conversations) to authenticated;
revoke all on function public.inbox_lock_conversation(uuid) from public, anon, authenticated;
revoke all on function public.inbox_assert_operator(public.conversations) from public, anon, authenticated;
revoke all on function public.inbox_event(public.conversations, text, uuid, text, text, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.conversations_sync_sla() from public, anon, authenticated;
revoke all on function public.areas_refresh_conversation_sla() from public, anon, authenticated;
revoke all on function public.org_settings_refresh_conversation_sla() from public, anon, authenticated;
revoke all on function public.add_business_minutes(timestamptz, integer, jsonb, date[], text) from public, anon;
revoke all on function public.business_minutes_between(timestamptz, timestamptz, jsonb, date[], text) from public, anon;
revoke all on function public.claim_conversation(uuid) from public, anon;
revoke all on function public.ensure_owner_for_reply(uuid) from public, anon;
revoke all on function public.delegate_conversation(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.accept_conversation_delegation(uuid) from public, anon;
revoke all on function public.reject_conversation_delegation(uuid, text) from public, anon;
revoke all on function public.move_conversation(uuid, text) from public, anon;
revoke all on function public.resolve_conversation(uuid) from public, anon;
revoke all on function public.set_conversation_area(uuid, uuid) from public, anon;
revoke all on function public.reopen_conversation(uuid, timestamptz, uuid) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.list_inbox_queue(uuid, uuid, text, boolean, boolean, boolean) from public, anon;
revoke all on function public.inbox_attention_count() from public, anon;
revoke all on function public.set_business_calendar(jsonb, date[]) from public, anon;

grant execute on function public.claim_conversation(uuid) to authenticated, service_role;
grant execute on function public.ensure_owner_for_reply(uuid) to authenticated, service_role;
grant execute on function public.delegate_conversation(uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.accept_conversation_delegation(uuid) to authenticated, service_role;
grant execute on function public.reject_conversation_delegation(uuid, text) to authenticated, service_role;
grant execute on function public.move_conversation(uuid, text) to authenticated, service_role;
grant execute on function public.resolve_conversation(uuid) to authenticated, service_role;
grant execute on function public.set_conversation_area(uuid, uuid) to authenticated, service_role;
grant execute on function public.reopen_conversation(uuid, timestamptz, uuid) to service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.list_inbox_queue(uuid, uuid, text, boolean, boolean, boolean) to authenticated, service_role;
grant execute on function public.inbox_attention_count() to authenticated, service_role;
grant execute on function public.set_business_calendar(jsonb, date[]) to authenticated, service_role;
grant execute on function public.add_business_minutes(timestamptz, integer, jsonb, date[], text) to authenticated, service_role;
grant execute on function public.business_minutes_between(timestamptz, timestamptz, jsonb, date[], text) to authenticated, service_role;

-- Realtime publication when the local stack created it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.conversations;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.conversation_events;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
