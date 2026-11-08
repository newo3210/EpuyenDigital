-- Tasks, notes, external contacts, sealed audit, case export.
-- Conversation transitions stay as they are. Task transitions are SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.task_kind as enum ('inquiry', 'complaint', 'procedure', 'documentation', 'referral', 'other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_status as enum ('pending', 'in_progress', 'done', 'cancelled', 'failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_outcome as enum ('resolved', 'abandoned', 'referred_outside', 'citizen_unresponsive', 'duplicate');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_audience as enum ('self', 'area', 'user', 'external');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.cancel_reason as enum (
    'citizen_unresponsive', 'duplicate', 'not_municipal', 'resolved_other_channel', 'wrong_area', 'other'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_event as enum (
    'CREATED', 'CLAIMED', 'DELEGATED', 'ACCEPTED', 'REJECTED', 'STATUS_CHANGED', 'DUE_CHANGED',
    'NOTE_ADDED', 'COMPLETED', 'CANCELLED', 'FAILED', 'REOPENED', 'ABANDONED',
    'EXTERNAL_NOTIFIED', 'EXTERNAL_REPLIED', 'BOT_CREATED'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.note_kind as enum ('observation', 'status_update', 'system', 'audit', 'bot_summary');
exception when duplicate_object then null; end $$;

alter table public.org_settings
  add column if not exists task_abandon_days integer not null default 14
    check (task_abandon_days > 0);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.external_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete restrict,
  full_name text not null,
  phone_normalized text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, phone_normalized)
);

create trigger external_contacts_set_updated_at
  before update on public.external_contacts
  for each row execute function public.set_updated_at();

create sequence if not exists public.task_public_ref_seq;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  citizen_id uuid references public.citizens (id) on delete set null,
  title text not null,
  body text,
  kind public.task_kind not null default 'other',
  priority smallint not null default 3 check (priority between 1 and 4),
  status public.task_status not null default 'pending',
  outcome public.task_outcome,
  audience public.task_audience not null,
  area_id uuid references public.areas (id) on delete restrict,
  assigned_user_id uuid references public.profiles (id) on delete set null,
  external_contact_id uuid references public.external_contacts (id) on delete set null,
  awaiting_acceptance boolean not null default false,
  delegated_from_user_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancel_reason_code public.cancel_reason,
  cancel_reason_text text,
  last_activity_at timestamptz not null default now(),
  public_ref text not null,
  notify_citizen_on_close boolean not null default false,
  source_note_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, public_ref)
);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create index if not exists tasks_board_idx
  on public.tasks (org_id, status, area_id, due_at);

create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  event public.task_event not null,
  actor_kind text not null check (actor_kind in ('operator', 'bot', 'system', 'external')),
  actor_user_id uuid references public.profiles (id) on delete set null,
  external_contact_id uuid references public.external_contacts (id) on delete set null,
  from_status public.task_status,
  to_status public.task_status,
  note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_history_task_idx on public.task_history (task_id, created_at);

create table if not exists public.task_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime text,
  size_bytes integer,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  body text not null,
  kind public.note_kind not null default 'observation',
  author_user_id uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete cascade,
  citizen_id uuid references public.citizens (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  parent_note_id uuid references public.notes (id) on delete cascade,
  correlation_id text,
  sealed_at timestamptz,
  content_hash text,
  seal_method text,
  created_at timestamptz not null default now(),
  check (
    conversation_id is not null
    or citizen_id is not null
    or task_id is not null
  )
);

create index if not exists notes_citizen_idx on public.notes (citizen_id, created_at desc);
create index if not exists notes_conversation_idx on public.notes (conversation_id, created_at desc);
create index if not exists notes_task_idx on public.notes (task_id, created_at desc);

alter table public.tasks
  drop constraint if exists tasks_source_note_id_fkey;
alter table public.tasks
  add constraint tasks_source_note_id_fkey
  foreign key (source_note_id) references public.notes (id) on delete set null;

create table if not exists public.note_reads (
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create table if not exists public.entity_mentions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  source_type text not null check (source_type in ('note', 'task')),
  source_id uuid not null,
  entity_type text not null check (entity_type in ('citizen', 'conversation', 'task', 'user', 'area')),
  entity_id uuid not null,
  label_snapshot text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.task_assert_editor()
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

create or replace function public.task_visible(t public.tasks)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  role public.user_role := public.current_user_role();
  uid uuid := auth.uid();
begin
  if t.org_id is distinct from public.current_org_id() then
    return false;
  end if;
  if role in ('admin', 'support') then
    return true;
  end if;
  return t.created_by = uid
    or t.assigned_user_id = uid
    or t.delegated_from_user_id = uid
    or (t.area_id is not null and t.area_id in (select public.current_area_ids()));
end;
$$;

create or replace function public.task_next_public_ref(p_org uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  n := nextval('public.task_public_ref_seq');
  return 'T-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function public.task_write_history(
  p_task uuid,
  p_org uuid,
  p_event public.task_event,
  p_actor_kind text,
  p_actor uuid,
  p_external uuid,
  p_from public.task_status,
  p_to public.task_status,
  p_note text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_history (
    org_id, task_id, event, actor_kind, actor_user_id, external_contact_id,
    from_status, to_status, note, details
  ) values (
    p_org, p_task, p_event, p_actor_kind, p_actor, p_external,
    p_from, p_to, p_note, coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

create or replace function public.task_touch(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks set last_activity_at = now() where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create task
-- ---------------------------------------------------------------------------
create or replace function public.create_task(
  p_conversation_id uuid,
  p_title text,
  p_body text,
  p_kind text,
  p_priority integer,
  p_audience text,
  p_area_id uuid,
  p_assigned_user_id uuid,
  p_external_contact_id uuid,
  p_due_at timestamptz,
  p_notify_citizen_on_close boolean,
  p_source_note_id uuid default null
)
returns table (result_id uuid, result_public_ref text, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  conv public.conversations;
  title text := regexp_replace(coalesce(p_title, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  audience public.task_audience;
  kind public.task_kind;
  contact public.external_contacts;
  new_id uuid;
  pref text;
  status public.task_status := 'pending';
  assignee uuid := null;
  area uuid := p_area_id;
  awaiting boolean := false;
begin
  uid := public.task_assert_editor();
  if title = '' then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  begin
    audience := p_audience::public.task_audience;
  exception when others then
    perform public.inbox_raise('INVALID_FIELD');
  end;
  begin
    kind := coalesce(nullif(p_kind, ''), 'other')::public.task_kind;
  exception when others then
    perform public.inbox_raise('INVALID_FIELD');
  end;
  if p_priority is null or p_priority < 1 or p_priority > 4 then
    perform public.inbox_raise('INVALID_FIELD');
  end if;

  if p_conversation_id is null then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  select * into conv from public.conversations where id = p_conversation_id;
  if not found or conv.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if not public.conversation_visible_to_caller(conv) then
    perform public.inbox_raise('FORBIDDEN');
  end if;

  if audience = 'self' then
    assignee := uid;
    status := 'in_progress';
    area := conv.area_id;
  elsif audience = 'area' then
    if p_area_id is null then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
    if not exists (
      select 1 from public.areas a
      where a.id = p_area_id and a.org_id = public.current_org_id()
    ) then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
  elsif audience = 'user' then
    if p_assigned_user_id is null then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = p_assigned_user_id and p.org_id = public.current_org_id() and p.is_active
    ) then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
    assignee := p_assigned_user_id;
    awaiting := true;
    area := conv.area_id;
  elsif audience = 'external' then
    if p_external_contact_id is null then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
    select * into contact from public.external_contacts
    where id = p_external_contact_id and org_id = public.current_org_id() and is_active;
    if not found then
      perform public.inbox_raise('INVALID_TARGET');
    end if;
    area := contact.area_id;
    awaiting := true;
  end if;

  pref := public.task_next_public_ref(public.current_org_id());
  insert into public.tasks (
    org_id, conversation_id, citizen_id, title, body, kind, priority, status, audience,
    area_id, assigned_user_id, external_contact_id, awaiting_acceptance, delegated_from_user_id,
    created_by, due_at, started_at, public_ref, notify_citizen_on_close, source_note_id
  ) values (
    public.current_org_id(), conv.id, conv.citizen_id, title, nullif(regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    kind, p_priority, status, audience,
    area, assignee, p_external_contact_id, awaiting,
    case when audience in ('user', 'external') then uid else null end,
    uid, p_due_at,
    case when status = 'in_progress' then now() else null end,
    pref, coalesce(p_notify_citizen_on_close, false), p_source_note_id
  ) returning id into new_id;

  perform public.task_write_history(
    new_id, public.current_org_id(), 'CREATED', 'operator', uid, null, null, status, null, '{}'::jsonb
  );

  if audience = 'external' then
    insert into public.jobs (org_id, job_type, payload)
    values (
      public.current_org_id(),
      'external_notify',
      jsonb_build_object('type', 'external_notify', 'taskId', new_id, 'orgId', public.current_org_id())
    );
    perform public.task_write_history(
      new_id, public.current_org_id(), 'EXTERNAL_NOTIFIED', 'system', null, p_external_contact_id, status, status, null, '{}'::jsonb
    );
  end if;

  result_id := new_id;
  result_public_ref := pref;
  result_hint := 'ok';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claim / accept / reject / start
-- ---------------------------------------------------------------------------
create or replace function public.claim_task(p_task_id uuid)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id for update;
  if not found or t.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if not public.task_visible(t) then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  if t.status not in ('pending', 'in_progress') then
    perform public.inbox_raise('INVALID_STATUS');
  end if;
  if t.audience = 'area' then
    if t.area_id is null or t.area_id not in (select public.current_area_ids()) then
      perform public.inbox_raise('FORBIDDEN');
    end if;
    if t.assigned_user_id is not null and t.assigned_user_id is distinct from uid then
      perform public.inbox_raise('CLAIM_CONFLICT', public.profile_display_name(t.assigned_user_id));
    end if;
  elsif t.audience = 'user' and t.awaiting_acceptance then
    if t.assigned_user_id is distinct from uid then
      perform public.inbox_raise('NOT_ASSIGNEE');
    end if;
  elsif t.assigned_user_id is not null and t.assigned_user_id is distinct from uid then
    perform public.inbox_raise('CLAIM_CONFLICT', public.profile_display_name(t.assigned_user_id));
  end if;

  update public.tasks
  set assigned_user_id = uid,
      status = 'in_progress',
      awaiting_acceptance = false,
      started_at = coalesce(started_at, now()),
      last_activity_at = now()
  where id = t.id;

  perform public.task_write_history(
    t.id, t.org_id,
    case when t.awaiting_acceptance then 'ACCEPTED'::public.task_event else 'CLAIMED'::public.task_event end,
    'operator', uid, null, t.status, 'in_progress', null, '{}'::jsonb
  );

  result_id := t.id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.accept_task(p_task_id uuid)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query select * from public.claim_task(p_task_id);
end;
$$;

create or replace function public.reject_task(p_task_id uuid, p_note text)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  t public.tasks;
  note text := regexp_replace(coalesce(p_note, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if note = '' then
    perform public.inbox_raise('NOTE_REQUIRED');
  end if;
  select * into t from public.tasks where id = p_task_id for update;
  if not found or t.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if not t.awaiting_acceptance or t.assigned_user_id is distinct from uid then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;
  update public.tasks
  set assigned_user_id = t.delegated_from_user_id,
      awaiting_acceptance = false,
      status = 'pending',
      last_activity_at = now()
  where id = t.id;
  perform public.task_write_history(
    t.id, t.org_id, 'REJECTED', 'operator', uid, null, t.status, 'pending', note, '{}'::jsonb
  );
  result_id := t.id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.start_task(p_task_id uuid)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id for update;
  if not found or t.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if t.assigned_user_id is distinct from uid then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;
  if t.status <> 'pending' then
    perform public.inbox_raise('INVALID_STATUS');
  end if;
  update public.tasks
  set status = 'in_progress', started_at = now(), last_activity_at = now()
  where id = t.id;
  perform public.task_write_history(
    t.id, t.org_id, 'STATUS_CHANGED', 'operator', uid, null, 'pending', 'in_progress', null, '{}'::jsonb
  );
  result_id := t.id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.delegate_task(
  p_task_id uuid,
  p_audience text,
  p_area_id uuid,
  p_assigned_user_id uuid,
  p_external_contact_id uuid,
  p_note text
)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  t public.tasks;
  note text := regexp_replace(coalesce(p_note, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  audience public.task_audience;
  contact public.external_contacts;
begin
  if note = '' then
    perform public.inbox_raise('NOTE_REQUIRED');
  end if;
  begin
    audience := p_audience::public.task_audience;
  exception when others then
    perform public.inbox_raise('INVALID_FIELD');
  end;
  select * into t from public.tasks where id = p_task_id for update;
  if not found or t.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if t.assigned_user_id is distinct from uid and t.created_by is distinct from uid then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;
  if t.status in ('done', 'cancelled', 'failed') then
    perform public.inbox_raise('INVALID_STATUS');
  end if;

  if audience = 'area' then
    if p_area_id is null then perform public.inbox_raise('INVALID_TARGET'); end if;
    update public.tasks set
      audience = 'area', area_id = p_area_id, assigned_user_id = null,
      external_contact_id = null, awaiting_acceptance = false,
      delegated_from_user_id = uid, status = 'pending', last_activity_at = now()
    where id = t.id;
  elsif audience = 'user' then
    if p_assigned_user_id is null then perform public.inbox_raise('INVALID_TARGET'); end if;
    update public.tasks set
      audience = 'user', assigned_user_id = p_assigned_user_id,
      external_contact_id = null, awaiting_acceptance = true,
      delegated_from_user_id = uid, status = 'pending', last_activity_at = now()
    where id = t.id;
  elsif audience = 'external' then
    if p_external_contact_id is null then perform public.inbox_raise('INVALID_TARGET'); end if;
    select * into contact from public.external_contacts
    where id = p_external_contact_id and org_id = t.org_id and is_active;
    if not found then perform public.inbox_raise('INVALID_TARGET'); end if;
    update public.tasks set
      audience = 'external', external_contact_id = contact.id, area_id = contact.area_id,
      assigned_user_id = null, awaiting_acceptance = true,
      delegated_from_user_id = uid, status = 'pending', last_activity_at = now()
    where id = t.id;
    insert into public.jobs (org_id, job_type, payload)
    values (t.org_id, 'external_notify', jsonb_build_object('type', 'external_notify', 'taskId', t.id, 'orgId', t.org_id));
  else
    perform public.inbox_raise('INVALID_FIELD');
  end if;

  perform public.task_write_history(
    t.id, t.org_id, 'DELEGATED', 'operator', uid, p_external_contact_id, t.status, 'pending', note, '{}'::jsonb
  );
  result_id := t.id;
  result_hint := 'ok';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Complete / cancel / reopen / abandon
-- ---------------------------------------------------------------------------
create or replace function public.complete_task(p_task_id uuid, p_outcome text)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  t public.tasks;
  outcome public.task_outcome;
begin
  begin
    outcome := p_outcome::public.task_outcome;
  exception when others then
    perform public.inbox_raise('INVALID_OUTCOME');
  end;
  select * into t from public.tasks where id = p_task_id for update;
  if not found or t.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if t.assigned_user_id is distinct from uid and public.current_user_role() <> 'admin' then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;
  if t.status in ('done', 'cancelled', 'failed') then
    perform public.inbox_raise('INVALID_STATUS');
  end if;
  update public.tasks set
    status = 'done', outcome = outcome, completed_at = now(), completed_by = uid, last_activity_at = now()
  where id = t.id;
  perform public.task_write_history(
    t.id, t.org_id, 'COMPLETED', 'operator', uid, null, t.status, 'done', null,
    jsonb_build_object('outcome', outcome::text)
  );
  -- Citizen WhatsApp notify is enqueued by the application after complete when notify_citizen_on_close is set.
  result_id := t.id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.cancel_task(p_task_id uuid, p_reason text, p_reason_text text)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  t public.tasks;
  reason public.cancel_reason;
  extra text := regexp_replace(coalesce(p_reason_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  begin
    reason := p_reason::public.cancel_reason;
  exception when others then
    perform public.inbox_raise('CANCEL_REASON_REQUIRED');
  end;
  if reason = 'other' and extra = '' then
    perform public.inbox_raise('CANCEL_REASON_REQUIRED');
  end if;
  select * into t from public.tasks where id = p_task_id for update;
  if not found or t.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if t.assigned_user_id is distinct from uid
     and t.created_by is distinct from uid
     and public.current_user_role() <> 'admin' then
    perform public.inbox_raise('NOT_ASSIGNEE');
  end if;
  if t.status in ('done', 'cancelled', 'failed') then
    perform public.inbox_raise('INVALID_STATUS');
  end if;
  update public.tasks set
    status = 'cancelled',
    cancel_reason_code = reason,
    cancel_reason_text = nullif(extra, ''),
    cancelled_at = now(),
    last_activity_at = now()
  where id = t.id;
  perform public.task_write_history(
    t.id, t.org_id, 'CANCELLED', 'operator', uid, null, t.status, 'cancelled', extra,
    jsonb_build_object('reason', reason::text)
  );
  result_id := t.id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.reopen_task(p_task_id uuid)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id for update;
  if not found or t.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if t.status not in ('done', 'cancelled', 'failed') then
    perform public.inbox_raise('INVALID_STATUS');
  end if;
  update public.tasks set
    status = 'pending',
    outcome = null,
    completed_at = null,
    completed_by = null,
    cancelled_at = null,
    cancel_reason_code = null,
    cancel_reason_text = null,
    last_activity_at = now()
  where id = t.id;
  perform public.task_write_history(
    t.id, t.org_id, 'REOPENED', 'operator', uid, null, t.status, 'pending', null, '{}'::jsonb
  );
  result_id := t.id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.abandon_stale_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := 0;
  r record;
  days integer;
begin
  for r in
    select t.*, s.task_abandon_days as days
    from public.tasks t
    join public.org_settings s on s.org_id = t.org_id
    where t.status in ('pending', 'in_progress')
      and t.last_activity_at < now() - make_interval(days => s.task_abandon_days)
    for update of t
  loop
    update public.tasks set
      status = 'cancelled',
      outcome = 'abandoned',
      cancelled_at = now(),
      last_activity_at = now()
    where id = r.id;
    perform public.task_write_history(
      r.id, r.org_id, 'ABANDONED', 'system', null, null, r.status, 'cancelled', null, '{}'::jsonb
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create or replace function public.create_note(
  p_body text,
  p_conversation_id uuid,
  p_citizen_id uuid,
  p_task_id uuid,
  p_parent_note_id uuid,
  p_kind text default 'observation'
)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.task_assert_editor();
  body text := regexp_replace(coalesce(p_body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  kind public.note_kind;
  parent public.notes;
  new_id uuid;
  cid uuid := p_citizen_id;
  conv public.conversations;
  t public.tasks;
begin
  if body = '' then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  begin
    kind := coalesce(nullif(p_kind, ''), 'observation')::public.note_kind;
  exception when others then
    perform public.inbox_raise('INVALID_FIELD');
  end;
  if p_conversation_id is null and p_citizen_id is null and p_task_id is null then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  if p_parent_note_id is not null then
    select * into parent from public.notes where id = p_parent_note_id;
    if not found or parent.org_id is distinct from public.current_org_id() then
      perform public.inbox_raise('NOT_FOUND');
    end if;
    if parent.parent_note_id is not null then
      perform public.inbox_raise('INVALID_FIELD');
    end if;
  end if;
  if p_conversation_id is not null then
    select * into conv from public.conversations where id = p_conversation_id;
    if not found or conv.org_id is distinct from public.current_org_id() then
      perform public.inbox_raise('NOT_FOUND');
    end if;
    if not public.conversation_visible_to_caller(conv) then
      perform public.inbox_raise('FORBIDDEN');
    end if;
    cid := coalesce(cid, conv.citizen_id);
  end if;
  if p_task_id is not null then
    select * into t from public.tasks where id = p_task_id;
    if not found or t.org_id is distinct from public.current_org_id() then
      perform public.inbox_raise('NOT_FOUND');
    end if;
    if not public.task_visible(t) then
      perform public.inbox_raise('FORBIDDEN');
    end if;
    cid := coalesce(cid, t.citizen_id);
    perform public.task_touch(t.id);
  end if;

  insert into public.notes (
    org_id, body, kind, author_user_id, conversation_id, citizen_id, task_id, parent_note_id
  ) values (
    public.current_org_id(), body, kind, uid, p_conversation_id, cid, p_task_id, p_parent_note_id
  ) returning id into new_id;

  result_id := new_id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.convert_note_to_task(
  p_note_id uuid,
  p_title text,
  p_kind text,
  p_priority integer,
  p_audience text,
  p_area_id uuid
)
returns table (result_id uuid, result_public_ref text, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.notes;
begin
  perform public.task_assert_editor();
  select * into n from public.notes where id = p_note_id;
  if not found or n.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if n.conversation_id is null then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  return query
  select * from public.create_task(
    n.conversation_id,
    coalesce(nullif(regexp_replace(coalesce(p_title, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''), left(n.body, 80)),
    n.body,
    p_kind,
    coalesce(p_priority, 3),
    coalesce(nullif(p_audience, ''), 'self'),
    p_area_id,
    null,
    null,
    null,
    false,
    n.id
  );
end;
$$;

create or replace function public.seal_audit_note(
  p_org_id uuid,
  p_body text,
  p_conversation_id uuid,
  p_citizen_id uuid,
  p_task_id uuid,
  p_correlation_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  hash text;
begin
  hash := encode(sha256(convert_to(coalesce(p_body, '') || '|' || coalesce(p_correlation_id, ''), 'UTF8')), 'hex');
  insert into public.notes (
    org_id, body, kind, author_user_id, conversation_id, citizen_id, task_id,
    correlation_id, sealed_at, content_hash, seal_method
  ) values (
    p_org_id, p_body, 'audit', null, p_conversation_id, p_citizen_id, p_task_id,
    p_correlation_id, now(), hash, 'sha256'
  ) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.notes_guard_sealed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.sealed_at is not null then
      raise exception 'SEALED' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.sealed_at is not null then
    raise exception 'SEALED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists notes_guard_sealed on public.notes;
create trigger notes_guard_sealed
  before update or delete on public.notes
  for each row execute function public.notes_guard_sealed();

-- ---------------------------------------------------------------------------
-- External command (service role / webhook)
-- ---------------------------------------------------------------------------
create or replace function public.apply_external_task_command(
  p_org_id uuid,
  p_phone text,
  p_text text
)
returns table (result_hint text, result_reply text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact public.external_contacts;
  raw text := regexp_replace(coalesce(p_text, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  upper_text text := upper(raw);
  ref text;
  detail text;
  t public.tasks;
  cmd text;
begin
  select * into contact
  from public.external_contacts
  where org_id = p_org_id and phone_normalized = p_phone and is_active
  limit 1;
  if not found then
    result_hint := 'NOT_EXTERNAL';
    result_reply := null;
    return next;
    return;
  end if;

  if upper_text ~ '^ACEPTO[[:space:]]+T-[0-9]+' then
    cmd := 'ACEPTO';
    ref := substring(upper_text from 'T-[0-9]+');
  elsif upper_text ~ '^RECHAZO[[:space:]]+T-[0-9]+' then
    cmd := 'RECHAZO';
    ref := substring(upper_text from 'T-[0-9]+');
    detail := regexp_replace(raw, '^(?i)rechazo[[:space:]]+T-[0-9]+[[:space:]]*', '');
  elsif upper_text ~ '^LISTO[[:space:]]+T-[0-9]+' then
    cmd := 'LISTO';
    ref := substring(upper_text from 'T-[0-9]+');
    detail := regexp_replace(raw, '^(?i)listo[[:space:]]+T-[0-9]+[[:space:]]*', '');
  elsif upper_text ~ '^NO SE PUEDE[[:space:]]+T-[0-9]+' then
    cmd := 'NO_SE_PUEDE';
    ref := substring(upper_text from 'T-[0-9]+');
    detail := regexp_replace(raw, '^(?i)no se puede[[:space:]]+T-[0-9]+[[:space:]]*', '');
  else
    result_hint := 'HELP';
    result_reply := 'Comandos: ACEPTO T-0001 | RECHAZO T-0001 motivo | LISTO T-0001 detalle | NO SE PUEDE T-0001 motivo';
    return next;
    return;
  end if;

  select * into t from public.tasks
  where org_id = p_org_id and public_ref = ref and external_contact_id = contact.id
  for update;
  if not found then
    result_hint := 'NOT_FOUND';
    result_reply := 'No encontramos la tarea ' || ref;
    return next;
    return;
  end if;

  if cmd = 'ACEPTO' then
    update public.tasks set awaiting_acceptance = false, status = 'in_progress',
      started_at = coalesce(started_at, now()), last_activity_at = now()
    where id = t.id;
    perform public.task_write_history(t.id, t.org_id, 'EXTERNAL_REPLIED', 'external', null, contact.id, t.status, 'in_progress', raw, '{}'::jsonb);
    perform public.task_write_history(t.id, t.org_id, 'ACCEPTED', 'external', null, contact.id, t.status, 'in_progress', null, '{}'::jsonb);
    result_hint := 'ok';
    result_reply := 'Tarea ' || ref || ' aceptada.';
  elsif cmd = 'RECHAZO' then
    if regexp_replace(coalesce(detail, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g') = '' then
      result_hint := 'NOTE_REQUIRED';
      result_reply := 'Indicá un motivo: RECHAZO ' || ref || ' motivo';
      return next;
      return;
    end if;
    update public.tasks set
      assigned_user_id = delegated_from_user_id,
      awaiting_acceptance = false,
      audience = 'area',
      external_contact_id = null,
      status = 'pending',
      last_activity_at = now()
    where id = t.id;
    perform public.task_write_history(t.id, t.org_id, 'EXTERNAL_REPLIED', 'external', null, contact.id, t.status, 'pending', detail, '{}'::jsonb);
    perform public.task_write_history(t.id, t.org_id, 'REJECTED', 'external', null, contact.id, t.status, 'pending', detail, '{}'::jsonb);
    result_hint := 'ok';
    result_reply := 'Tarea ' || ref || ' rechazada.';
  elsif cmd = 'LISTO' then
    update public.tasks set status = 'done', outcome = 'resolved', completed_at = now(), last_activity_at = now()
    where id = t.id;
    perform public.task_write_history(t.id, t.org_id, 'EXTERNAL_REPLIED', 'external', null, contact.id, t.status, 'done', detail, '{}'::jsonb);
    perform public.task_write_history(t.id, t.org_id, 'COMPLETED', 'external', null, contact.id, t.status, 'done', detail, jsonb_build_object('outcome', 'resolved'));
    perform public.seal_audit_note(t.org_id, coalesce(detail, 'LISTO'), t.conversation_id, t.citizen_id, t.id, 'external-listo-' || t.id::text);
    result_hint := 'ok';
    result_reply := 'Tarea ' || ref || ' marcada como lista.';
  else
    update public.tasks set status = 'failed', cancelled_at = now(), last_activity_at = now()
    where id = t.id;
    perform public.task_write_history(t.id, t.org_id, 'EXTERNAL_REPLIED', 'external', null, contact.id, t.status, 'failed', detail, '{}'::jsonb);
    perform public.task_write_history(t.id, t.org_id, 'FAILED', 'external', null, contact.id, t.status, 'failed', detail, '{}'::jsonb);
    perform public.seal_audit_note(t.org_id, coalesce(detail, 'NO SE PUEDE'), t.conversation_id, t.citizen_id, t.id, 'external-fail-' || t.id::text);
    result_hint := 'ok';
    result_reply := 'Tarea ' || ref || ' marcada como no se puede.';
  end if;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- List / export
-- ---------------------------------------------------------------------------
create or replace function public.list_tasks(
  p_status text default null,
  p_area_id uuid default null
)
returns table (
  result_id uuid,
  result_public_ref text,
  result_title text,
  result_status text,
  result_kind text,
  result_priority integer,
  result_area_id uuid,
  result_assigned_user_id uuid,
  result_due_at timestamptz,
  result_overdue boolean,
  result_conversation_id uuid,
  result_citizen_id uuid,
  result_awaiting_acceptance boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_org_id() is null then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  return query
  select
    t.id, t.public_ref, t.title, t.status::text, t.kind::text, t.priority,
    t.area_id, t.assigned_user_id, t.due_at,
    (t.due_at is not null and t.due_at < now() and t.status in ('pending', 'in_progress')),
    t.conversation_id, t.citizen_id, t.awaiting_acceptance
  from public.tasks t
  where t.org_id = public.current_org_id()
    and public.task_visible(t)
    and (p_status is null or t.status::text = p_status)
    and (p_area_id is null or t.area_id = p_area_id)
  order by
    (t.due_at is not null and t.due_at < now() and t.status in ('pending', 'in_progress')) desc,
    t.due_at nulls last,
    t.last_activity_at desc
  limit 100;
end;
$$;

create or replace function public.export_case(p_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  payload jsonb;
begin
  if auth.uid() is null or public.current_org_id() is null then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  select * into conv from public.conversations where id = p_conversation_id;
  if not found or conv.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  if not public.conversation_visible_to_caller(conv) then
    perform public.inbox_raise('FORBIDDEN');
  end if;

  payload := jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', conv.id,
      'phone', conv.phone_normalized,
      'areaId', conv.area_id,
      'queueColumn', conv.queue_column,
      'citizenId', conv.citizen_id
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'direction', m.direction, 'kind', m.kind, 'body', m.body, 'createdAt', m.created_at
      ) order by m.created_at)
      from public.messages m where m.conversation_id = conv.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'type', e.event_type, 'note', e.note, 'createdAt', e.created_at
      ) order by e.created_at)
      from public.conversation_events e where e.conversation_id = conv.id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'publicRef', t.public_ref, 'title', t.title, 'status', t.status,
        'history', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'event', h.event, 'note', h.note, 'createdAt', h.created_at
          ) order by h.created_at), '[]'::jsonb)
          from public.task_history h where h.task_id = t.id
        )
      ) order by t.created_at)
      from public.tasks t where t.conversation_id = conv.id
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'body', n.body, 'kind', n.kind, 'sealed', n.sealed_at is not null, 'createdAt', n.created_at
      ) order by n.created_at)
      from public.notes n where n.conversation_id = conv.id
    ), '[]'::jsonb)
  );
  return payload;
end;
$$;

-- External contacts admin helpers
create or replace function public.upsert_external_contact(
  p_id uuid,
  p_area_id uuid,
  p_full_name text,
  p_phone text,
  p_is_active boolean
)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  name text := regexp_replace(coalesce(p_full_name, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  phone text := regexp_replace(coalesce(p_phone, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  new_id uuid;
begin
  if uid is null or public.current_user_role() is distinct from 'admin' then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  if name = '' or phone = '' or p_area_id is null then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  if not exists (select 1 from public.areas a where a.id = p_area_id and a.org_id = public.current_org_id()) then
    perform public.inbox_raise('INVALID_TARGET');
  end if;
  if p_id is null then
    insert into public.external_contacts (org_id, area_id, full_name, phone_normalized, is_active)
    values (public.current_org_id(), p_area_id, name, phone, coalesce(p_is_active, true))
    returning id into new_id;
  else
    update public.external_contacts
    set area_id = p_area_id, full_name = name, phone_normalized = phone, is_active = coalesce(p_is_active, true)
    where id = p_id and org_id = public.current_org_id()
    returning id into new_id;
    if new_id is null then
      perform public.inbox_raise('NOT_FOUND');
    end if;
  end if;
  result_id := new_id;
  result_hint := 'ok';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend merge + timeline
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

  perform c.id
  from public.citizens c
  where c.id in (keep_row.id, drop_row.id)
  order by c.id
  for update;

  select * into keep_row from public.citizens where id = keep_row.id;
  select * into drop_row from public.citizens where id = drop_row.id;
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
  update public.tasks set citizen_id = keep_row.id where citizen_id = drop_row.id;
  update public.notes set citizen_id = keep_row.id where citizen_id = drop_row.id;

  update public.citizens
  set merged_into_id = keep_row.id,
      merge_note = note
  where id = drop_row.id;

  result_id := keep_row.id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.list_citizen_timeline(p_id uuid)
returns table (
  result_kind text,
  result_id uuid,
  result_at timestamptz,
  result_label text,
  result_detail text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  row public.citizens;
begin
  if auth.uid() is null or public.current_org_id() is null then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  select * into row from public.citizens where id = p_id;
  if not found or row.org_id is distinct from public.current_org_id() then
    perform public.inbox_raise('NOT_FOUND');
  end if;

  return query
  select items.result_kind, items.result_id, items.result_at, items.result_label, items.result_detail
  from (
    (
      select 'message'::text as result_kind, m.id as result_id, m.created_at as result_at,
             m.direction as result_label, m.body as result_detail
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where c.citizen_id = row.id and c.org_id = row.org_id
      order by m.created_at desc
      limit 50
    )
    union all
    (
      select 'event'::text, e.id, e.created_at, e.event_type, e.note
      from public.conversation_events e
      join public.conversations c on c.id = e.conversation_id
      where c.citizen_id = row.id and c.org_id = row.org_id
      order by e.created_at desc
      limit 50
    )
    union all
    (
      select 'animal'::text, a.id, a.created_at, a.name, (a.species || ' · ' || a.municipal_id)
      from public.animals a
      where a.citizen_id = row.id and a.org_id = row.org_id
      order by a.created_at desc
    )
    union all
    (
      select 'note'::text, n.id, n.created_at, n.kind::text, n.body
      from public.notes n
      where n.citizen_id = row.id and n.org_id = row.org_id
      order by n.created_at desc
      limit 50
    )
    union all
    (
      select 'task'::text, t.id, t.created_at, t.public_ref, t.title
      from public.tasks t
      where t.citizen_id = row.id and t.org_id = row.org_id
      order by t.created_at desc
      limit 50
    )
  ) items;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.external_contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
alter table public.task_files enable row level security;
alter table public.notes enable row level security;
alter table public.note_reads enable row level security;
alter table public.entity_mentions enable row level security;

drop policy if exists external_contacts_select_org on public.external_contacts;
create policy external_contacts_select_org on public.external_contacts
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists tasks_select_visible on public.tasks;
create policy tasks_select_visible on public.tasks
  for select to authenticated
  using (public.task_visible(tasks));

drop policy if exists task_history_select_visible on public.task_history;
create policy task_history_select_visible on public.task_history
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_history.task_id and public.task_visible(t)
    )
  );

drop policy if exists task_files_select_visible on public.task_files;
create policy task_files_select_visible on public.task_files
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id and public.task_visible(t)
    )
  );

drop policy if exists notes_select_org on public.notes;
create policy notes_select_org on public.notes
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists note_reads_own on public.note_reads;
create policy note_reads_own on public.note_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists entity_mentions_select_org on public.entity_mentions;
create policy entity_mentions_select_org on public.entity_mentions
  for select to authenticated
  using (org_id = public.current_org_id());

revoke insert, update, delete on public.external_contacts from public, anon, authenticated;
revoke insert, update, delete on public.tasks from public, anon, authenticated;
revoke insert, update, delete on public.task_history from public, anon, authenticated;
revoke insert, update, delete on public.task_files from public, anon, authenticated;
revoke insert, update, delete on public.notes from public, anon, authenticated;
revoke insert, update, delete on public.entity_mentions from public, anon, authenticated;

grant select on public.external_contacts to authenticated;
grant select on public.tasks to authenticated;
grant select on public.task_history to authenticated;
grant select on public.task_files to authenticated;
grant select on public.notes to authenticated;
grant select on public.entity_mentions to authenticated;

-- Grants on functions
revoke all on function public.task_assert_editor() from public, anon, authenticated;
revoke all on function public.task_visible(public.tasks) from public, anon;
grant execute on function public.task_visible(public.tasks) to authenticated;
revoke all on function public.task_next_public_ref(uuid) from public, anon, authenticated;
revoke all on function public.task_write_history(uuid, uuid, public.task_event, text, uuid, uuid, public.task_status, public.task_status, text, jsonb) from public, anon, authenticated;
revoke all on function public.task_touch(uuid) from public, anon, authenticated;
revoke all on function public.notes_guard_sealed() from public, anon, authenticated;
revoke all on function public.seal_audit_note(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.seal_audit_note(uuid, text, uuid, uuid, uuid, text) to service_role;

revoke all on function public.create_task(uuid, text, text, text, integer, text, uuid, uuid, uuid, timestamptz, boolean, uuid) from public, anon;
revoke all on function public.claim_task(uuid) from public, anon;
revoke all on function public.accept_task(uuid) from public, anon;
revoke all on function public.reject_task(uuid, text) from public, anon;
revoke all on function public.start_task(uuid) from public, anon;
revoke all on function public.delegate_task(uuid, text, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.complete_task(uuid, text) from public, anon;
revoke all on function public.cancel_task(uuid, text, text) from public, anon;
revoke all on function public.reopen_task(uuid) from public, anon;
revoke all on function public.abandon_stale_tasks() from public, anon, authenticated;
revoke all on function public.create_note(text, uuid, uuid, uuid, uuid, text) from public, anon;
revoke all on function public.convert_note_to_task(uuid, text, text, integer, text, uuid) from public, anon;
revoke all on function public.apply_external_task_command(uuid, text, text) from public, anon, authenticated;
revoke all on function public.list_tasks(text, uuid) from public, anon;
revoke all on function public.export_case(uuid) from public, anon;
revoke all on function public.upsert_external_contact(uuid, uuid, text, text, boolean) from public, anon;

grant execute on function public.create_task(uuid, text, text, text, integer, text, uuid, uuid, uuid, timestamptz, boolean, uuid) to authenticated, service_role;
grant execute on function public.claim_task(uuid) to authenticated, service_role;
grant execute on function public.accept_task(uuid) to authenticated, service_role;
grant execute on function public.reject_task(uuid, text) to authenticated, service_role;
grant execute on function public.start_task(uuid) to authenticated, service_role;
grant execute on function public.delegate_task(uuid, text, uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.complete_task(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_task(uuid, text, text) to authenticated, service_role;
grant execute on function public.reopen_task(uuid) to authenticated, service_role;
grant execute on function public.abandon_stale_tasks() to service_role;
grant execute on function public.create_note(text, uuid, uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.convert_note_to_task(uuid, text, text, integer, text, uuid) to authenticated, service_role;
grant execute on function public.apply_external_task_command(uuid, text, text) to service_role;
grant execute on function public.list_tasks(text, uuid) to authenticated, service_role;
grant execute on function public.export_case(uuid) to authenticated, service_role;
grant execute on function public.upsert_external_contact(uuid, uuid, text, text, boolean) to authenticated, service_role;
