-- Mesa de Entrada inbox - conversation events, read state, quick replies,
-- triage RPCs (claim/delegate/accept/reject/ensure_owner/move/resolve/reopen/set_area),
-- area RLS, SLA helpers, inquiry coords denorm, realtime publication.
-- Change: mesa-entrada-inbox (Phase 3 - INB-01..15)

-- ---------------------------------------------------------------------------
-- org_settings: business hours + holidays for SLA (calendar fallback when empty)
-- ---------------------------------------------------------------------------
alter table public.org_settings
  add column if not exists business_hours jsonb not null default '{}'::jsonb,
  add column if not exists holidays date[] not null default '{}',
  add column if not exists bot_paused boolean not null default false;

comment on column public.org_settings.business_hours is
  'Per weekday ranges {"mon":[{"start":"08:00","end":"16:00"}],...}; empty → calendar elapsed minutes.';
comment on column public.org_settings.holidays is
  'Dates excluded from business-hours SLA counting.';
comment on column public.org_settings.bot_paused is
  'Global menu/bot pause; resolve may resume conversation bot_state only when false.';

-- ---------------------------------------------------------------------------
-- conversations: inquiry coords denorm (never write citizens.lat/lng)
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists inquiry_latitude double precision,
  add column if not exists inquiry_longitude double precision,
  add column if not exists last_message_preview text,
  add column if not exists has_attachments boolean not null default false;

comment on column public.conversations.inquiry_latitude is
  'Latest WhatsApp inquiry pin for Mesa map cards; never copied to citizens GPS.';
comment on column public.conversations.inquiry_longitude is
  'Latest WhatsApp inquiry pin for Mesa map cards; never copied to citizens GPS.';

create index if not exists conversations_fifo_unowned_idx
  on public.conversations (org_id, area_id, entered_queue_at)
  where queue_column <> 'resolved' and owner_user_id is null;

create index if not exists conversations_owned_inbound_idx
  on public.conversations (org_id, area_id, last_inbound_at desc nulls last)
  where queue_column <> 'resolved' and owner_user_id is not null;

create index if not exists conversations_pending_delegate_idx
  on public.conversations (org_id, owner_user_id)
  where awaiting_acceptance and queue_column <> 'resolved';

-- ---------------------------------------------------------------------------
-- conversation_events (append-only timeline)
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'QUEUED', 'CLAIMED', 'MOVED', 'DELEGATED', 'ACCEPTED', 'REJECTED',
      'RESOLVED', 'REOPENED', 'BOT_PAUSED', 'BOT_RESUMED', 'AREA_CHANGED'
    )),
  actor_kind text not null
    check (actor_kind in ('operator', 'bot', 'system', 'external')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  from_column text,
  to_column text,
  from_area_id uuid references public.areas(id) on delete set null,
  to_area_id uuid references public.areas(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversation_events_conversation_idx
  on public.conversation_events (conversation_id, created_at);

create index if not exists conversation_events_org_idx
  on public.conversation_events (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- conversation_reads (per-operator read state)
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  last_read_message_id uuid references public.messages(id) on delete set null,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_reads_user_idx
  on public.conversation_reads (user_id, last_read_at desc);

-- ---------------------------------------------------------------------------
-- quick_replies (+ municipal seed)
-- ---------------------------------------------------------------------------
create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  area_id uuid references public.areas(id) on delete cascade,
  shortcut text not null,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, shortcut)
);

create trigger quick_replies_set_updated_at
before update on public.quick_replies
for each row execute function public.set_updated_at();

create index if not exists quick_replies_org_active_idx
  on public.quick_replies (org_id, is_active)
  where is_active;

insert into public.quick_replies (org_id, area_id, shortcut, title, body, is_active)
select
  o.id,
  null,
  v.shortcut,
  v.title,
  v.body,
  true
from public.organizations o
cross join (
  values
    (
      '/saludo',
      'Saludo municipal',
      'Hola, te escribe la Mesa de Entrada de la Municipalidad de Epuyén. ¿En qué podemos ayudarte?'
    ),
    (
      '/horario',
      'Horario de atención',
      'Nuestro horario de atención es de lunes a viernes de 8 a 14 hs. Fuera de ese horario dejá tu consulta y te respondemos a la brevedad.'
    ),
    (
      '/derivacion',
      'Derivación en curso',
      'Recibimos tu consulta y la estamos derivando al área correspondiente. Te vamos a responder por este mismo chat.'
    ),
    (
      '/gracias',
      'Cierre amable',
      'Gracias por comunicarte. Quedamos a disposición por este canal.'
    )
) as v(shortcut, title, body)
where o.slug = 'epuyen'
on conflict (org_id, shortcut) do nothing;

-- ---------------------------------------------------------------------------
-- Helper: can current user see/act on conversation area (admin = all org)
-- ---------------------------------------------------------------------------
create or replace function public.conversation_area_accessible(p_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.current_org_id() is not null
    and (
      public.current_user_role() = 'admin'
      or p_area_id in (select public.current_area_ids())
    );
$$;

revoke execute on function public.conversation_area_accessible(uuid) from public, anon;
grant execute on function public.conversation_area_accessible(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helper: insert conversation event (security invoker; called inside RPCs)
-- ---------------------------------------------------------------------------
create or replace function public.insert_conversation_event(
  p_org_id uuid,
  p_conversation_id uuid,
  p_event_type text,
  p_actor_kind text,
  p_actor_user_id uuid,
  p_from_column text default null,
  p_to_column text default null,
  p_from_area_id uuid default null,
  p_to_area_id uuid default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.conversation_events (
    org_id, conversation_id, event_type, actor_kind, actor_user_id,
    from_column, to_column, from_area_id, to_area_id, note, metadata
  ) values (
    p_org_id, p_conversation_id, p_event_type, p_actor_kind, p_actor_user_id,
    p_from_column, p_to_column, p_from_area_id, p_to_area_id, p_note,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.insert_conversation_event(
  uuid, uuid, text, text, uuid, text, text, uuid, uuid, text, jsonb
) from public, anon;
grant execute on function public.insert_conversation_event(
  uuid, uuid, text, text, uuid, text, text, uuid, uuid, text, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SLA: business-minute elapsed between two timestamps (empty hours → calendar)
-- ---------------------------------------------------------------------------
create or replace function public.business_minutes_between(
  p_org_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hours jsonb;
  v_holidays date[];
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_cursor timestamptz;
  v_end timestamptz;
  v_minutes integer := 0;
  v_day date;
  v_dow text;
  v_ranges jsonb;
  v_range jsonb;
  v_start_local time;
  v_end_local time;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_seg_start timestamptz;
  v_seg_end timestamptz;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    return 0;
  end if;

  select coalesce(os.business_hours, '{}'::jsonb), coalesce(os.holidays, '{}')
  into v_hours, v_holidays
  from public.org_settings os
  where os.org_id = p_org_id;

  if v_hours is null or v_hours = '{}'::jsonb then
    return greatest(0, floor(extract(epoch from (p_to - p_from)) / 60)::integer);
  end if;

  v_cursor := p_from;
  v_end := p_to;

  while v_cursor < v_end loop
    v_day := (v_cursor at time zone v_tz)::date;
    if v_holidays is not null and v_day = any (v_holidays) then
      v_cursor := ((v_day + 1)::timestamp at time zone v_tz);
      continue;
    end if;

    v_dow := case extract(isodow from v_day)
      when 1 then 'mon'
      when 2 then 'tue'
      when 3 then 'wed'
      when 4 then 'thu'
      when 5 then 'fri'
      when 6 then 'sat'
      else 'sun'
    end;

    v_ranges := coalesce(v_hours -> v_dow, '[]'::jsonb);
    if jsonb_typeof(v_ranges) <> 'array' or jsonb_array_length(v_ranges) = 0 then
      v_cursor := ((v_day + 1)::timestamp at time zone v_tz);
      continue;
    end if;

    for v_range in select * from jsonb_array_elements(v_ranges)
    loop
      v_start_local := (v_range ->> 'start')::time;
      v_end_local := (v_range ->> 'end')::time;
      if v_start_local is null or v_end_local is null or v_end_local <= v_start_local then
        continue;
      end if;
      v_day_start := ((v_day::text || ' ' || v_start_local::text)::timestamp at time zone v_tz);
      v_day_end := ((v_day::text || ' ' || v_end_local::text)::timestamp at time zone v_tz);
      v_seg_start := greatest(v_cursor, v_day_start);
      v_seg_end := least(v_end, v_day_end);
      if v_seg_end > v_seg_start then
        v_minutes := v_minutes + floor(extract(epoch from (v_seg_end - v_seg_start)) / 60)::integer;
      end if;
    end loop;

    v_cursor := ((v_day + 1)::timestamp at time zone v_tz);
  end loop;

  return v_minutes;
end;
$$;

revoke execute on function public.business_minutes_between(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.business_minutes_between(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

-- compute_conversation_sla_status: ok | warning | critical
create or replace function public.compute_conversation_sla_status(
  p_conversation_id uuid,
  p_now timestamptz default now()
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_area_id uuid;
  v_entered timestamptz;
  v_queue text;
  v_warn integer;
  v_crit integer;
  v_elapsed integer;
begin
  select c.org_id, c.area_id, c.entered_queue_at, c.queue_column
  into v_org_id, v_area_id, v_entered, v_queue
  from public.conversations c
  where c.id = p_conversation_id;

  if v_org_id is null or v_queue = 'resolved' then
    return 'ok';
  end if;

  select a.sla_warning_minutes, a.sla_critical_minutes
  into v_warn, v_crit
  from public.areas a
  where a.id = v_area_id;

  if v_warn is null and v_crit is null then
    return 'ok';
  end if;

  v_elapsed := public.business_minutes_between(v_org_id, v_entered, p_now);

  if v_crit is not null and v_elapsed >= v_crit then
    return 'critical';
  end if;
  if v_warn is not null and v_elapsed >= v_warn then
    return 'warning';
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.compute_conversation_sla_status(uuid, timestamptz)
  from public, anon;
grant execute on function public.compute_conversation_sla_status(uuid, timestamptz)
  to authenticated, service_role;

-- add_business_minutes: advance wall clock by N business minutes (matches business_minutes_between)
create or replace function public.add_business_minutes(
  p_org_id uuid,
  p_from timestamptz,
  p_minutes integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hours jsonb;
  v_holidays date[];
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_cursor timestamptz := p_from;
  v_remaining integer := greatest(0, coalesce(p_minutes, 0));
  v_day date;
  v_dow text;
  v_ranges jsonb;
  v_range jsonb;
  v_start_local time;
  v_end_local time;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_seg_start timestamptz;
  v_seg_end timestamptz;
  v_avail integer;
  v_guard integer := 0;
begin
  if v_remaining = 0 then
    return p_from;
  end if;

  select o.timezone into v_tz
  from public.organizations o
  where o.id = p_org_id;
  if v_tz is null or length(trim(v_tz)) = 0 then
    v_tz := 'America/Argentina/Buenos_Aires';
  end if;

  select coalesce(os.business_hours, '{}'::jsonb), coalesce(os.holidays, '{}')
  into v_hours, v_holidays
  from public.org_settings os
  where os.org_id = p_org_id;

  if v_hours is null or v_hours = '{}'::jsonb then
    return p_from + make_interval(mins => v_remaining);
  end if;

  while v_remaining > 0 and v_guard < 800 loop
    v_guard := v_guard + 1;
    v_day := (v_cursor at time zone v_tz)::date;
    if v_holidays is not null and v_day = any (v_holidays) then
      v_cursor := ((v_day + 1)::timestamp at time zone v_tz);
      continue;
    end if;

    v_dow := case extract(isodow from v_day)
      when 1 then 'mon'
      when 2 then 'tue'
      when 3 then 'wed'
      when 4 then 'thu'
      when 5 then 'fri'
      when 6 then 'sat'
      else 'sun'
    end;

    v_ranges := coalesce(v_hours -> v_dow, '[]'::jsonb);
    if jsonb_typeof(v_ranges) <> 'array' or jsonb_array_length(v_ranges) = 0 then
      v_cursor := ((v_day + 1)::timestamp at time zone v_tz);
      continue;
    end if;

    for v_range in select * from jsonb_array_elements(v_ranges)
    loop
      exit when v_remaining <= 0;
      v_start_local := (v_range ->> 'start')::time;
      v_end_local := (v_range ->> 'end')::time;
      if v_start_local is null or v_end_local is null or v_end_local <= v_start_local then
        continue;
      end if;
      v_day_start := ((v_day::text || ' ' || v_start_local::text)::timestamp at time zone v_tz);
      v_day_end := ((v_day::text || ' ' || v_end_local::text)::timestamp at time zone v_tz);
      v_seg_start := greatest(v_cursor, v_day_start);
      v_seg_end := v_day_end;
      if v_seg_end <= v_seg_start then
        continue;
      end if;
      v_avail := floor(extract(epoch from (v_seg_end - v_seg_start)) / 60)::integer;
      if v_avail <= 0 then
        continue;
      end if;
      if v_remaining <= v_avail then
        return v_seg_start + make_interval(mins => v_remaining);
      end if;
      v_remaining := v_remaining - v_avail;
      v_cursor := v_seg_end;
    end loop;

    v_cursor := ((v_day + 1)::timestamp at time zone v_tz);
  end loop;

  return v_cursor;
end;
$$;

revoke execute on function public.add_business_minutes(uuid, timestamptz, integer)
  from public, anon;
grant execute on function public.add_business_minutes(uuid, timestamptz, integer)
  to authenticated, service_role;

-- Refresh sla_due_at using area critical minutes as business-minute due clock
create or replace function public.refresh_conversation_sla_due(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_area_id uuid;
  v_entered timestamptz;
  v_crit integer;
begin
  select c.org_id, c.area_id, c.entered_queue_at
  into v_org_id, v_area_id, v_entered
  from public.conversations c
  where c.id = p_conversation_id
  for update;

  if v_org_id is null then
    return;
  end if;

  select a.sla_critical_minutes into v_crit
  from public.areas a where a.id = v_area_id;

  if v_crit is null then
    update public.conversations set sla_due_at = null where id = p_conversation_id;
    return;
  end if;

  update public.conversations
  set sla_due_at = public.add_business_minutes(v_org_id, v_entered, v_crit)
  where id = p_conversation_id;
end;
$$;

revoke execute on function public.refresh_conversation_sla_due(uuid) from public, anon;
grant execute on function public.refresh_conversation_sla_due(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Internal: lock conversation + authz for transitions
-- ---------------------------------------------------------------------------
create or replace function public.lock_conversation_for_transition(p_conversation_id uuid)
returns public.conversations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_org uuid := public.current_org_id();
  v_role text := public.current_user_role();
begin
  if v_uid is null or v_org is null then
    raise exception 'forbidden'
      using errcode = 'P0001',
            detail = 'NOT_AUTHENTICATED';
  end if;

  select * into v_row
  from public.conversations c
  where c.id = p_conversation_id
  for update;

  if not found then
    raise exception 'conversation_not_found'
      using errcode = 'P0001',
            detail = 'NOT_FOUND';
  end if;

  if v_row.org_id is distinct from v_org then
    raise exception 'forbidden'
      using errcode = 'P0001',
            detail = 'WRONG_ORG';
  end if;

  -- Admin / current owner always; else area membership OR pending delegation targeting caller
  if v_role <> 'admin'
     and v_row.owner_user_id is distinct from v_uid
     and not public.conversation_area_accessible(v_row.area_id)
     and not (
       v_row.awaiting_acceptance
       and (
         v_row.owner_user_id = v_uid
         or (
           v_row.pending_area_id is not null
           and v_row.pending_area_id in (select public.current_area_ids())
         )
       )
     )
     and v_row.delegated_from_user_id is distinct from v_uid
  then
    raise exception 'forbidden'
      using errcode = 'P0001',
            detail = 'AREA_FORBIDDEN';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.lock_conversation_for_transition(uuid) from public, anon;
grant execute on function public.lock_conversation_for_transition(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- claim_conversation
-- ---------------------------------------------------------------------------
create or replace function public.claim_conversation(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  owner_user_id uuid,
  queue_column text,
  bot_state text,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_from text;
  v_event uuid;
  v_accepting_area boolean := false;
begin
  v_row := public.lock_conversation_for_transition(p_conversation_id);
  v_from := v_row.queue_column;

  if v_row.queue_column = 'resolved' then
    raise exception 'invalid_state'
      using errcode = 'P0001',
            detail = 'RESOLVED';
  end if;

  -- Area delegation: claim-as-accept when pending_area_id and no owner
  if v_row.awaiting_acceptance
     and v_row.pending_area_id is not null
     and v_row.owner_user_id is null
  then
    if public.current_user_role() <> 'admin'
       and v_row.pending_area_id not in (select public.current_area_ids())
    then
      raise exception 'forbidden'
        using errcode = 'P0001',
              detail = 'AREA_DELEGATION_FORBIDDEN';
    end if;
    v_accepting_area := true;
  elsif v_row.owner_user_id is not null then
    if v_row.owner_user_id = v_uid and not v_row.awaiting_acceptance then
      -- Idempotent self-claim
      conversation_id := v_row.id;
      owner_user_id := v_row.owner_user_id;
      queue_column := v_row.queue_column;
      bot_state := v_row.bot_state;
      event_id := null;
      return next;
      return;
    end if;
    raise exception 'CLAIM_CONFLICT'
      using errcode = 'P0001',
            detail = format('owned_by:%s', v_row.owner_user_id);
  end if;

  update public.conversations c
  set
    owner_user_id = v_uid,
    awaiting_acceptance = false,
    pending_area_id = null,
    delegated_from_user_id = case when v_accepting_area then null else c.delegated_from_user_id end,
    bot_state = 'paused',
    queue_column = case
      when c.queue_column in ('new', 'resolved') then 'claimed'
      else c.queue_column
    end,
    resolved_at = null,
    resolved_by = null
  where c.id = v_row.id
  returning c.* into v_row;

  v_event := public.insert_conversation_event(
    v_row.org_id,
    v_row.id,
    case when v_accepting_area then 'ACCEPTED' else 'CLAIMED' end,
    'operator',
    v_uid,
    v_from,
    v_row.queue_column,
    null,
    null,
    null,
    jsonb_build_object('via', case when v_accepting_area then 'area_claim' else 'claim' end)
  );

  perform public.insert_conversation_event(
    v_row.org_id, v_row.id, 'BOT_PAUSED', 'system', null,
    null, null, null, null, null, '{}'::jsonb
  );

  perform public.refresh_conversation_sla_due(v_row.id);

  conversation_id := v_row.id;
  owner_user_id := v_row.owner_user_id;
  queue_column := v_row.queue_column;
  bot_state := v_row.bot_state;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.claim_conversation(uuid) from public, anon;
grant execute on function public.claim_conversation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- accept_conversation_delegation (user target)
-- ---------------------------------------------------------------------------
create or replace function public.accept_conversation_delegation(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  owner_user_id uuid,
  queue_column text,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_event uuid;
begin
  v_row := public.lock_conversation_for_transition(p_conversation_id);

  if not v_row.awaiting_acceptance or v_row.owner_user_id is distinct from v_uid then
    raise exception 'CLAIM_CONFLICT'
      using errcode = 'P0001',
            detail = 'NOT_PENDING_FOR_CALLER';
  end if;

  update public.conversations c
  set
    awaiting_acceptance = false,
    delegated_from_user_id = null,
    pending_area_id = null,
    bot_state = 'paused',
    queue_column = case when c.queue_column = 'new' then 'claimed' else c.queue_column end
  where c.id = v_row.id
  returning c.* into v_row;

  v_event := public.insert_conversation_event(
    v_row.org_id, v_row.id, 'ACCEPTED', 'operator', v_uid,
    null, v_row.queue_column, null, null, null, '{}'::jsonb
  );

  conversation_id := v_row.id;
  owner_user_id := v_row.owner_user_id;
  queue_column := v_row.queue_column;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.accept_conversation_delegation(uuid) from public, anon;
grant execute on function public.accept_conversation_delegation(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reject_conversation_delegation
-- ---------------------------------------------------------------------------
create or replace function public.reject_conversation_delegation(
  p_conversation_id uuid,
  p_note text
)
returns table (
  conversation_id uuid,
  owner_user_id uuid,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_event uuid;
  v_return_to uuid;
  v_is_area boolean;
  v_is_lead boolean := false;
begin
  v_row := public.lock_conversation_for_transition(p_conversation_id);

  if not v_row.awaiting_acceptance then
    raise exception 'invalid_state'
      using errcode = 'P0001',
            detail = 'NOT_AWAITING';
  end if;

  v_is_area := v_row.pending_area_id is not null and v_row.owner_user_id is null;

  if v_is_area then
    select exists (
      select 1 from public.area_members am
      where am.area_id = v_row.pending_area_id
        and am.user_id = v_uid
        and am.is_lead
    ) into v_is_lead;
    if public.current_user_role() not in ('admin', 'area_lead') and not v_is_lead then
      raise exception 'forbidden'
        using errcode = 'P0001',
              detail = 'AREA_REJECT_REQUIRES_LEAD';
    end if;
  else
    if v_row.owner_user_id is distinct from v_uid then
      raise exception 'CLAIM_CONFLICT'
        using errcode = 'P0001',
              detail = 'NOT_PENDING_FOR_CALLER';
    end if;
  end if;

  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'invalid_argument'
      using errcode = '22023',
            detail = 'NOTE_REQUIRED';
  end if;

  v_return_to := v_row.delegated_from_user_id;

  update public.conversations c
  set
    owner_user_id = v_return_to,
    awaiting_acceptance = false,
    pending_area_id = null,
    delegated_from_user_id = null,
    bot_state = case when v_return_to is null then c.bot_state else 'paused' end,
    queue_column = case
      when v_return_to is null then 'new'
      when c.queue_column = 'new' then 'claimed'
      else c.queue_column
    end
  where c.id = v_row.id
  returning c.* into v_row;

  v_event := public.insert_conversation_event(
    v_row.org_id, v_row.id, 'REJECTED', 'operator', v_uid,
    null, v_row.queue_column, null, null, trim(p_note),
    jsonb_build_object('returned_to', v_return_to)
  );

  conversation_id := v_row.id;
  owner_user_id := v_row.owner_user_id;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.reject_conversation_delegation(uuid, text)
  from public, anon;
grant execute on function public.reject_conversation_delegation(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- delegate_conversation (user XOR area)
-- ---------------------------------------------------------------------------
create or replace function public.delegate_conversation(
  p_conversation_id uuid,
  p_target_user_id uuid default null,
  p_target_area_id uuid default null,
  p_note text default null
)
returns table (
  conversation_id uuid,
  owner_user_id uuid,
  pending_area_id uuid,
  awaiting_acceptance boolean,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_event uuid;
  v_target_org uuid;
  v_from_area uuid;
begin
  v_row := public.lock_conversation_for_transition(p_conversation_id);

  if v_row.owner_user_id is distinct from v_uid then
    raise exception 'CLAIM_CONFLICT'
      using errcode = 'P0001',
            detail = 'NOT_OWNER';
  end if;

  if v_row.awaiting_acceptance then
    raise exception 'invalid_state'
      using errcode = 'P0001',
            detail = 'ALREADY_AWAITING';
  end if;

  if (p_target_user_id is null and p_target_area_id is null)
     or (p_target_user_id is not null and p_target_area_id is not null)
  then
    raise exception 'invalid_argument'
      using errcode = '22023',
            detail = 'TARGET_XOR';
  end if;

  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'invalid_argument'
      using errcode = '22023',
            detail = 'NOTE_REQUIRED';
  end if;

  -- Capture source area before any update so DELEGATED audit keeps correct from_area_id.
  v_from_area := v_row.area_id;

  if p_target_user_id is not null then
    if p_target_user_id = v_uid then
      raise exception 'invalid_argument'
        using errcode = '22023',
              detail = 'CANNOT_DELEGATE_SELF';
    end if;
    select p.org_id into v_target_org
    from public.profiles p
    where p.id = p_target_user_id and p.is_active;
    if v_target_org is distinct from v_row.org_id then
      raise exception 'invalid_argument'
        using errcode = '22023',
              detail = 'TARGET_USER_INVALID';
    end if;

    update public.conversations c
    set
      owner_user_id = p_target_user_id,
      delegated_from_user_id = v_uid,
      pending_area_id = null,
      awaiting_acceptance = true
    where c.id = v_row.id
    returning c.* into v_row;
  else
    select a.org_id into v_target_org
    from public.areas a
    where a.id = p_target_area_id and a.is_active;
    if v_target_org is distinct from v_row.org_id then
      raise exception 'invalid_argument'
        using errcode = '22023',
              detail = 'TARGET_AREA_INVALID';
    end if;

    update public.conversations c
    set
      owner_user_id = null,
      delegated_from_user_id = v_uid,
      pending_area_id = p_target_area_id,
      awaiting_acceptance = true,
      area_id = p_target_area_id
    where c.id = v_row.id
    returning c.* into v_row;
  end if;

  v_event := public.insert_conversation_event(
    v_row.org_id, v_row.id, 'DELEGATED', 'operator', v_uid,
    null, null,
    case when p_target_area_id is not null then v_from_area else null end,
    p_target_area_id,
    trim(p_note),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_area_id', p_target_area_id
    )
  );

  conversation_id := v_row.id;
  owner_user_id := v_row.owner_user_id;
  pending_area_id := v_row.pending_area_id;
  awaiting_acceptance := v_row.awaiting_acceptance;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.delegate_conversation(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.delegate_conversation(uuid, uuid, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ensure_owner_for_reply
-- ---------------------------------------------------------------------------
create or replace function public.ensure_owner_for_reply(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  owner_user_id uuid,
  action text,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_claimed record;
  v_accepted record;
begin
  v_row := public.lock_conversation_for_transition(p_conversation_id);

  if v_row.queue_column = 'resolved' then
    raise exception 'invalid_state'
      using errcode = 'P0001',
            detail = 'RESOLVED';
  end if;

  -- Pending user delegation for self → accept
  if v_row.awaiting_acceptance
     and v_row.owner_user_id = v_uid
     and v_row.pending_area_id is null
  then
    select * into v_accepted from public.accept_conversation_delegation(p_conversation_id);
    conversation_id := v_accepted.conversation_id;
    owner_user_id := v_accepted.owner_user_id;
    action := 'accepted';
    event_id := v_accepted.event_id;
    return next;
    return;
  end if;

  -- Area pending → claim-as-accept
  if v_row.awaiting_acceptance
     and v_row.pending_area_id is not null
     and v_row.owner_user_id is null
  then
    select * into v_claimed from public.claim_conversation(p_conversation_id);
    conversation_id := v_claimed.conversation_id;
    owner_user_id := v_claimed.owner_user_id;
    action := 'accepted_area';
    event_id := v_claimed.event_id;
    return next;
    return;
  end if;

  -- Already owner (not awaiting)
  if v_row.owner_user_id = v_uid and not v_row.awaiting_acceptance then
    conversation_id := v_row.id;
    owner_user_id := v_uid;
    action := 'already_owner';
    event_id := null;
    return next;
    return;
  end if;

  -- Unowned → claim
  if v_row.owner_user_id is null and not v_row.awaiting_acceptance then
    select * into v_claimed from public.claim_conversation(p_conversation_id);
    conversation_id := v_claimed.conversation_id;
    owner_user_id := v_claimed.owner_user_id;
    action := 'claimed';
    event_id := v_claimed.event_id;
    return next;
    return;
  end if;

  raise exception 'CLAIM_CONFLICT'
    using errcode = 'P0001',
          detail = format('owned_by:%s', v_row.owner_user_id);
end;
$$;

revoke execute on function public.ensure_owner_for_reply(uuid) from public, anon;
grant execute on function public.ensure_owner_for_reply(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- move_conversation
-- ---------------------------------------------------------------------------
create or replace function public.move_conversation(
  p_conversation_id uuid,
  p_to_column text
)
returns table (
  conversation_id uuid,
  queue_column text,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_from text;
  v_event uuid;
begin
  if p_to_column not in ('claimed', 'in_progress', 'waiting_external') then
    raise exception 'invalid_argument'
      using errcode = '22023',
            detail = 'INVALID_COLUMN';
  end if;

  v_row := public.lock_conversation_for_transition(p_conversation_id);

  if v_row.owner_user_id is distinct from v_uid or v_row.awaiting_acceptance then
    raise exception 'CLAIM_CONFLICT'
      using errcode = 'P0001',
            detail = 'NOT_OWNER';
  end if;

  if v_row.queue_column = 'resolved' then
    raise exception 'invalid_state'
      using errcode = 'P0001',
            detail = 'RESOLVED';
  end if;

  v_from := v_row.queue_column;

  update public.conversations c
  set queue_column = p_to_column
  where c.id = v_row.id
  returning c.* into v_row;

  v_event := public.insert_conversation_event(
    v_row.org_id, v_row.id, 'MOVED', 'operator', v_uid,
    v_from, p_to_column, null, null, null, '{}'::jsonb
  );

  conversation_id := v_row.id;
  queue_column := v_row.queue_column;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.move_conversation(uuid, text) from public, anon;
grant execute on function public.move_conversation(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- resolve_conversation
-- ---------------------------------------------------------------------------
create or replace function public.resolve_conversation(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  queue_column text,
  bot_state text,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_from text;
  v_event uuid;
  v_bot_paused boolean := false;
  v_new_bot text;
begin
  v_row := public.lock_conversation_for_transition(p_conversation_id);

  if v_row.owner_user_id is distinct from v_uid or v_row.awaiting_acceptance then
    raise exception 'CLAIM_CONFLICT'
      using errcode = 'P0001',
            detail = 'NOT_OWNER';
  end if;

  v_from := v_row.queue_column;

  select coalesce(os.bot_paused, false) into v_bot_paused
  from public.org_settings os
  where os.org_id = v_row.org_id;

  v_new_bot := case when v_bot_paused then 'paused' else 'active' end;

  update public.conversations c
  set
    queue_column = 'resolved',
    needs_response = false,
    resolved_at = now(),
    resolved_by = v_uid,
    bot_state = v_new_bot,
    awaiting_acceptance = false,
    pending_area_id = null,
    delegated_from_user_id = null,
    sla_due_at = null
  where c.id = v_row.id
  returning c.* into v_row;

  v_event := public.insert_conversation_event(
    v_row.org_id, v_row.id, 'RESOLVED', 'operator', v_uid,
    v_from, 'resolved', null, null, null, '{}'::jsonb
  );

  if v_new_bot = 'active' then
    perform public.insert_conversation_event(
      v_row.org_id, v_row.id, 'BOT_RESUMED', 'system', null,
      null, null, null, null, null, '{}'::jsonb
    );
  end if;

  conversation_id := v_row.id;
  queue_column := v_row.queue_column;
  bot_state := v_row.bot_state;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.resolve_conversation(uuid) from public, anon;
grant execute on function public.resolve_conversation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reopen_conversation (webhook / service role; also callable authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.reopen_conversation(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  queue_column text,
  bot_state text,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_from text;
  v_event uuid;
  v_bot_paused boolean := false;
  v_new_bot text;
begin
  select * into v_row
  from public.conversations c
  where c.id = p_conversation_id
  for update;

  if not found then
    raise exception 'conversation_not_found'
      using errcode = 'P0001',
            detail = 'NOT_FOUND';
  end if;

  if v_row.queue_column <> 'resolved' then
    conversation_id := v_row.id;
    queue_column := v_row.queue_column;
    bot_state := v_row.bot_state;
    event_id := null;
    return next;
    return;
  end if;

  v_from := v_row.queue_column;

  select coalesce(os.bot_paused, false) into v_bot_paused
  from public.org_settings os
  where os.org_id = v_row.org_id;

  v_new_bot := case when v_bot_paused then 'paused' else 'active' end;

  update public.conversations c
  set
    queue_column = 'new',
    owner_user_id = null,
    awaiting_acceptance = false,
    pending_area_id = null,
    delegated_from_user_id = null,
    resolved_at = null,
    resolved_by = null,
    entered_queue_at = now(),
    needs_response = true,
    bot_state = v_new_bot
  where c.id = v_row.id
  returning c.* into v_row;

  perform public.refresh_conversation_sla_due(v_row.id);

  v_event := public.insert_conversation_event(
    v_row.org_id, v_row.id, 'REOPENED', 'system', null,
    v_from, 'new', null, null, null, '{}'::jsonb
  );

  perform public.insert_conversation_event(
    v_row.org_id, v_row.id, 'QUEUED', 'system', null,
    null, 'new', null, null, null, '{}'::jsonb
  );

  conversation_id := v_row.id;
  queue_column := v_row.queue_column;
  bot_state := v_row.bot_state;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.reopen_conversation(uuid) from public, anon;
grant execute on function public.reopen_conversation(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_conversation_area (manual shared-line routing)
-- ---------------------------------------------------------------------------
create or replace function public.set_conversation_area(
  p_conversation_id uuid,
  p_area_id uuid
)
returns table (
  conversation_id uuid,
  area_id uuid,
  event_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_role text := public.current_user_role();
  v_from uuid;
  v_event uuid;
  v_target_org uuid;
begin
  v_row := public.lock_conversation_for_transition(p_conversation_id);

  if v_role not in ('admin', 'area_lead', 'operator') then
    raise exception 'forbidden'
      using errcode = 'P0001',
            detail = 'ROLE_FORBIDDEN';
  end if;

  -- Operators/leads must own or be admin; admin may always set
  if v_role <> 'admin'
     and (v_row.owner_user_id is distinct from v_uid or v_row.awaiting_acceptance)
  then
    raise exception 'CLAIM_CONFLICT'
      using errcode = 'P0001',
            detail = 'NOT_OWNER';
  end if;

  select a.org_id into v_target_org
  from public.areas a
  where a.id = p_area_id and a.is_active;
  if v_target_org is distinct from v_row.org_id then
    raise exception 'invalid_argument'
      using errcode = '22023',
            detail = 'AREA_INVALID';
  end if;

  v_from := v_row.area_id;

  update public.conversations c
  set area_id = p_area_id
  where c.id = v_row.id
  returning c.* into v_row;

  perform public.refresh_conversation_sla_due(v_row.id);

  v_event := public.insert_conversation_event(
    v_row.org_id, v_row.id, 'AREA_CHANGED', 'operator', v_uid,
    null, null, v_from, p_area_id, null, '{}'::jsonb
  );

  conversation_id := v_row.id;
  area_id := v_row.area_id;
  event_id := v_event;
  return next;
end;
$$;

revoke execute on function public.set_conversation_area(uuid, uuid) from public, anon;
grant execute on function public.set_conversation_area(uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mark_conversation_read
-- ---------------------------------------------------------------------------
create or replace function public.mark_conversation_read(
  p_conversation_id uuid,
  p_message_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.conversations;
  v_uid uuid := auth.uid();
  v_org uuid := public.current_org_id();
begin
  if v_uid is null or v_org is null then
    raise exception 'forbidden'
      using errcode = 'P0001',
            detail = 'NOT_AUTHENTICATED';
  end if;

  select * into v_row
  from public.conversations c
  where c.id = p_conversation_id;

  if not found or v_row.org_id is distinct from v_org then
    raise exception 'conversation_not_found'
      using errcode = 'P0001',
            detail = 'NOT_FOUND';
  end if;

  insert into public.conversation_reads (
    conversation_id, user_id, org_id, last_read_at, last_read_message_id
  ) values (
    p_conversation_id, v_uid, v_org, now(), p_message_id
  )
  on conflict (conversation_id, user_id) do update
  set
    last_read_at = excluded.last_read_at,
    last_read_message_id = coalesce(excluded.last_read_message_id, public.conversation_reads.last_read_message_id);
end;
$$;

revoke execute on function public.mark_conversation_read(uuid, uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: conversations / messages / events / reads / quick_replies
-- ---------------------------------------------------------------------------
alter table public.conversation_events enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.quick_replies enable row level security;

revoke all on public.conversation_events, public.conversation_reads, public.quick_replies
  from anon;
revoke all on public.conversation_events from authenticated;
revoke all on public.conversation_reads from authenticated;
revoke all on public.quick_replies from authenticated;

grant select on public.conversation_events to authenticated;
grant select, insert, update on public.conversation_reads to authenticated;
grant select on public.quick_replies to authenticated;
grant insert, update on public.quick_replies to authenticated;
grant all on public.conversation_events, public.conversation_reads, public.quick_replies
  to service_role;

-- Visibility predicate for conversations (area + delegation)
-- Admin: all org. Else: area in current_area_ids OR pending target OR delegator.
drop policy if exists conversations_select_org on public.conversations;
create policy conversations_select_area on public.conversations
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() = 'admin'
      or area_id in (select public.current_area_ids())
      or (
        awaiting_acceptance
        and owner_user_id = auth.uid()
      )
      or (
        awaiting_acceptance
        and pending_area_id is not null
        and pending_area_id in (select public.current_area_ids())
      )
      or delegated_from_user_id = auth.uid()
      or owner_user_id = auth.uid()
    )
  );

drop policy if exists messages_select_org on public.messages;
create policy messages_select_area on public.messages
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_user_role() = 'admin'
      or exists (
        select 1
        from public.conversations c
        where c.id = messages.conversation_id
          and (
            c.area_id in (select public.current_area_ids())
            or c.owner_user_id = auth.uid()
            or c.delegated_from_user_id = auth.uid()
            or (
              c.awaiting_acceptance
              and c.owner_user_id = auth.uid()
            )
            or (
              c.awaiting_acceptance
              and c.pending_area_id is not null
              and c.pending_area_id in (select public.current_area_ids())
            )
          )
      )
    )
  );

drop policy if exists conversation_events_select on public.conversation_events;
create policy conversation_events_select on public.conversation_events
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_events.conversation_id
    )
  );

drop policy if exists conversation_reads_select on public.conversation_reads;
create policy conversation_reads_select on public.conversation_reads
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and user_id = auth.uid()
  );

drop policy if exists conversation_reads_insert on public.conversation_reads;
create policy conversation_reads_insert on public.conversation_reads
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and user_id = auth.uid()
  );

drop policy if exists conversation_reads_update on public.conversation_reads;
create policy conversation_reads_update on public.conversation_reads
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and user_id = auth.uid()
  )
  with check (
    org_id = public.current_org_id()
    and user_id = auth.uid()
  );

drop policy if exists quick_replies_select on public.quick_replies;
create policy quick_replies_select on public.quick_replies
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and is_active
    and (
      area_id is null
      or public.current_user_role() = 'admin'
      or area_id in (select public.current_area_ids())
    )
  );

drop policy if exists quick_replies_admin_write on public.quick_replies;
create policy quick_replies_admin_write on public.quick_replies
  for all to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  )
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- Realtime publication (ignore if already members / publication missing)
-- ---------------------------------------------------------------------------
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
end;
$$;
