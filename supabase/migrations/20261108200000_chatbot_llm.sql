-- Chatbot LLM: knowledge base, bot_runs, org bot settings, retrieval helper.
-- Claim/resolve already pause/resume bot_state; this change adds RAG decision storage.

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

do $$ begin
  create type public.bot_decision as enum ('answered', 'asked_clarification', 'handoff', 'silent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.handoff_reason as enum (
    'low_confidence', 'sensitive_topic', 'citizen_requested', 'out_of_hours', 'empty_knowledge', 'kill_switch', 'paused'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.knowledge_source_kind as enum ('pdf', 'text', 'faq', 'url');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.knowledge_index_status as enum ('pending', 'indexing', 'ready', 'failed');
exception when duplicate_object then null; end $$;

alter table public.org_settings
  add column if not exists bot_paused boolean not null default false,
  add column if not exists mesa_bot_enabled boolean not null default true,
  add column if not exists bot_confidence_threshold numeric not null default 0.2
    check (bot_confidence_threshold > 0 and bot_confidence_threshold <= 1),
  add column if not exists privacy_notice_text text not null default
    'Aviso de privacidad (Ley 25.326): tus datos se usan solo para atender tu consulta municipal.',
  add column if not exists out_of_hours_message text not null default
    'Estamos fuera del horario de atención. Tu mensaje queda en cola y te respondemos a la brevedad.';

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  source_kind public.knowledge_source_kind not null default 'text',
  storage_path text,
  body_text text,
  area_id uuid references public.areas (id) on delete set null,
  is_active boolean not null default true,
  valid_until timestamptz,
  indexed_at timestamptz,
  index_status public.knowledge_index_status not null default 'pending',
  index_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger knowledge_documents_set_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

create index if not exists knowledge_documents_org_idx
  on public.knowledge_documents (org_id, is_active, index_status);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists knowledge_chunks_org_doc_idx
  on public.knowledge_chunks (org_id, document_id);

create table if not exists public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  trigger_message_id uuid references public.messages (id) on delete set null,
  decision public.bot_decision not null,
  answer text,
  sources jsonb not null default '[]'::jsonb,
  confidence numeric,
  handoff_reason public.handoff_reason,
  suggested_area_id uuid references public.areas (id) on delete set null,
  topic text,
  urgency text,
  extracted_fields jsonb not null default '{}'::jsonb,
  model text,
  latency_ms integer,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);

create index if not exists bot_runs_conversation_idx
  on public.bot_runs (conversation_id, created_at desc);

alter table public.conversations
  add column if not exists privacy_notice_sent_at timestamptz,
  add column if not exists handoff_ack_sent_at timestamptz,
  add column if not exists bot_awaiting_clarification boolean not null default false,
  add column if not exists bot_pending_fields jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Admin knowledge RPCs
-- ---------------------------------------------------------------------------
create or replace function public.upsert_knowledge_document(
  p_id uuid,
  p_title text,
  p_source_kind text,
  p_body_text text,
  p_storage_path text,
  p_area_id uuid,
  p_is_active boolean,
  p_valid_until timestamptz
)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  title text := regexp_replace(coalesce(p_title, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  kind public.knowledge_source_kind;
  new_id uuid;
begin
  if uid is null or public.current_user_role() is distinct from 'admin' then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  if title = '' then
    perform public.inbox_raise('INVALID_FIELD');
  end if;
  begin
    kind := coalesce(nullif(p_source_kind, ''), 'text')::public.knowledge_source_kind;
  exception when others then
    perform public.inbox_raise('INVALID_FIELD');
  end;
  if p_id is null then
    insert into public.knowledge_documents (
      org_id, title, source_kind, body_text, storage_path, area_id, is_active, valid_until, created_by, index_status
    ) values (
      public.current_org_id(), title, kind, nullif(p_body_text, ''), p_storage_path, p_area_id,
      coalesce(p_is_active, true), p_valid_until, uid, 'pending'
    ) returning id into new_id;
  else
    update public.knowledge_documents
    set title = title,
        source_kind = kind,
        body_text = nullif(p_body_text, ''),
        storage_path = coalesce(p_storage_path, storage_path),
        area_id = p_area_id,
        is_active = coalesce(p_is_active, is_active),
        valid_until = p_valid_until,
        index_status = 'pending',
        indexed_at = null,
        index_error = null
    where id = p_id and org_id = public.current_org_id()
    returning id into new_id;
    if new_id is null then
      perform public.inbox_raise('NOT_FOUND');
    end if;
  end if;
  insert into public.jobs (org_id, job_type, payload, status)
  values (
    public.current_org_id(),
    'index_document',
    jsonb_build_object('type', 'index_document', 'documentId', new_id, 'orgId', public.current_org_id()),
    'pending'
  );
  result_id := new_id;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.set_org_bot_paused(p_paused boolean)
returns table (result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'admin' then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  update public.org_settings
  set bot_paused = coalesce(p_paused, false)
  where org_id = public.current_org_id();
  if not found then
    insert into public.org_settings (org_id, bot_paused)
    values (public.current_org_id(), coalesce(p_paused, false));
  end if;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.list_knowledge_documents()
returns table (
  result_id uuid,
  result_title text,
  result_source_kind text,
  result_is_active boolean,
  result_index_status text,
  result_valid_until timestamptz,
  result_area_id uuid,
  result_updated_at timestamptz
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
  select d.id, d.title, d.source_kind::text, d.is_active, d.index_status::text, d.valid_until, d.area_id, d.updated_at
  from public.knowledge_documents d
  where d.org_id = public.current_org_id()
  order by d.updated_at desc
  limit 100;
end;
$$;

create or replace function public.list_bot_runs(p_conversation_id uuid)
returns table (
  result_id uuid,
  result_decision text,
  result_answer text,
  result_confidence numeric,
  result_handoff_reason text,
  result_sources jsonb,
  result_topic text,
  result_urgency text,
  result_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
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
  return query
  select r.id, r.decision::text, r.answer, r.confidence, r.handoff_reason::text, r.sources, r.topic, r.urgency, r.created_at
  from public.bot_runs r
  where r.conversation_id = p_conversation_id
  order by r.created_at desc
  limit 50;
end;
$$;

-- Text retrieval fallback when embeddings are unavailable locally.
create or replace function public.search_knowledge_chunks(p_org_id uuid, p_query text, p_limit integer default 5)
returns table (
  result_chunk_id uuid,
  result_document_id uuid,
  result_title text,
  result_content text,
  result_score numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := regexp_replace(coalesce(p_query, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if p_org_id is null or q = '' then
    return;
  end if;
  return query
  select c.id, d.id, d.title, c.content,
    (extensions.similarity(c.content, q))::numeric as score
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.org_id = p_org_id
    and d.is_active
    and d.index_status = 'ready'
    and (d.valid_until is null or d.valid_until > now())
    and (
      c.content ilike '%' || left(q, 80) || '%'
      or extensions.similarity(c.content, q) > 0.1
    )
  order by score desc nulls last, c.chunk_index
  limit greatest(coalesce(p_limit, 5), 1);
end;
$$;

-- Service helpers
create or replace function public.insert_bot_run(
  p_org_id uuid,
  p_conversation_id uuid,
  p_trigger_message_id uuid,
  p_decision text,
  p_answer text,
  p_sources jsonb,
  p_confidence numeric,
  p_handoff_reason text,
  p_suggested_area_id uuid,
  p_topic text,
  p_urgency text,
  p_extracted_fields jsonb,
  p_model text,
  p_latency_ms integer,
  p_tokens_in integer,
  p_tokens_out integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  decision public.bot_decision;
  reason public.handoff_reason;
begin
  decision := p_decision::public.bot_decision;
  if p_handoff_reason is null or p_handoff_reason = '' then
    reason := null;
  else
    reason := p_handoff_reason::public.handoff_reason;
  end if;
  insert into public.bot_runs (
    org_id, conversation_id, trigger_message_id, decision, answer, sources, confidence,
    handoff_reason, suggested_area_id, topic, urgency, extracted_fields, model, latency_ms, tokens_in, tokens_out
  ) values (
    p_org_id, p_conversation_id, p_trigger_message_id, decision, p_answer, coalesce(p_sources, '[]'::jsonb),
    p_confidence, reason, p_suggested_area_id, p_topic, p_urgency, coalesce(p_extracted_fields, '{}'::jsonb),
    p_model, p_latency_ms, p_tokens_in, p_tokens_out
  ) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.replace_knowledge_chunks(
  p_document_id uuid,
  p_chunks jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.knowledge_documents;
  item jsonb;
  n integer := 0;
begin
  select * into doc from public.knowledge_documents where id = p_document_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  delete from public.knowledge_chunks where document_id = p_document_id;
  for item in select * from jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb))
  loop
    insert into public.knowledge_chunks (org_id, document_id, chunk_index, content, metadata)
    values (
      doc.org_id,
      doc.id,
      coalesce((item->>'chunkIndex')::integer, n),
      item->>'content',
      coalesce(item->'metadata', '{}'::jsonb)
    );
    n := n + 1;
  end loop;
  update public.knowledge_documents
  set index_status = 'ready', indexed_at = now(), index_error = null
  where id = doc.id;
  return n;
end;
$$;

-- RLS
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.bot_runs enable row level security;

drop policy if exists knowledge_documents_select_org on public.knowledge_documents;
create policy knowledge_documents_select_org on public.knowledge_documents
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists knowledge_chunks_select_org on public.knowledge_chunks;
create policy knowledge_chunks_select_org on public.knowledge_chunks
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists bot_runs_select_visible on public.bot_runs;
create policy bot_runs_select_visible on public.bot_runs
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.conversations c
      where c.id = bot_runs.conversation_id and public.conversation_visible_to_caller(c)
    )
  );

revoke insert, update, delete on public.knowledge_documents from public, anon, authenticated;
revoke insert, update, delete on public.knowledge_chunks from public, anon, authenticated;
revoke insert, update, delete on public.bot_runs from public, anon, authenticated;
grant select on public.knowledge_documents to authenticated;
grant select on public.knowledge_chunks to authenticated;
grant select on public.bot_runs to authenticated;

revoke all on function public.upsert_knowledge_document(uuid, text, text, text, text, uuid, boolean, timestamptz) from public, anon;
revoke all on function public.set_org_bot_paused(boolean) from public, anon;
revoke all on function public.list_knowledge_documents() from public, anon;
revoke all on function public.list_bot_runs(uuid) from public, anon;
revoke all on function public.search_knowledge_chunks(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.insert_bot_run(uuid, uuid, uuid, text, text, jsonb, numeric, text, uuid, text, text, jsonb, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.replace_knowledge_chunks(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.upsert_knowledge_document(uuid, text, text, text, text, uuid, boolean, timestamptz) to authenticated, service_role;
grant execute on function public.set_org_bot_paused(boolean) to authenticated, service_role;
grant execute on function public.list_knowledge_documents() to authenticated, service_role;
grant execute on function public.list_bot_runs(uuid) to authenticated, service_role;
grant execute on function public.search_knowledge_chunks(uuid, text, integer) to service_role;
grant execute on function public.insert_bot_run(uuid, uuid, uuid, text, text, jsonb, numeric, text, uuid, text, text, jsonb, text, integer, integer, integer) to service_role;
grant execute on function public.replace_knowledge_chunks(uuid, jsonb) to service_role;

-- Resolve must not resume the bot while the org kill-switch pause is on (design D5).
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
  paused boolean := false;
  next_bot text := 'active';
begin
  conv := public.inbox_lock_conversation(p_conversation_id);
  uid := public.inbox_assert_operator(conv);
  if conv.owner_user_id is distinct from uid and public.current_user_role() <> 'admin' then
    perform public.inbox_raise('NOT_OWNER');
  end if;

  select coalesce(s.bot_paused, false) into paused
  from public.org_settings s
  where s.org_id = conv.org_id;
  if paused then
    next_bot := 'paused';
  end if;

  update public.conversations c
  set queue_column = 'resolved',
      resolved_at = now(),
      resolved_by = uid,
      bot_state = next_bot,
      awaiting_acceptance = false,
      pending_area_id = null,
      delegated_from_user_id = null
  where c.id = conv.id;

  perform public.inbox_event(conv, 'RESOLVED', uid, conv.queue_column, 'resolved', null, null, null, '{}');
  if not paused then
    perform public.inbox_event(conv, 'BOT_RESUMED', uid, null, null, null, null, null, '{}');
  end if;

  result_conversation_id := conv.id;
  result_owner_user_id := conv.owner_user_id;
  result_owner_name := public.profile_display_name(uid);
  result_queue_column := 'resolved';
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.set_knowledge_document_active(p_id uuid, p_is_active boolean)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'admin' then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  update public.knowledge_documents
  set is_active = coalesce(p_is_active, is_active)
  where id = p_id and org_id = public.current_org_id()
  returning id into result_id;
  if result_id is null then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  result_hint := 'ok';
  return next;
end;
$$;

create or replace function public.reindex_knowledge_document(p_id uuid)
returns table (result_id uuid, result_hint text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc_id uuid;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'admin' then
    perform public.inbox_raise('FORBIDDEN');
  end if;
  update public.knowledge_documents
  set index_status = 'pending', indexed_at = null, index_error = null
  where id = p_id and org_id = public.current_org_id()
  returning id into doc_id;
  if doc_id is null then
    perform public.inbox_raise('NOT_FOUND');
  end if;
  insert into public.jobs (org_id, job_type, payload, status)
  values (
    public.current_org_id(),
    'index_document',
    jsonb_build_object('type', 'index_document', 'documentId', doc_id, 'orgId', public.current_org_id()),
    'pending'
  );
  result_id := doc_id;
  result_hint := 'ok';
  return next;
end;
$$;

revoke all on function public.set_knowledge_document_active(uuid, boolean) from public, anon;
revoke all on function public.reindex_knowledge_document(uuid) from public, anon;
grant execute on function public.set_knowledge_document_active(uuid, boolean) to authenticated, service_role;
grant execute on function public.reindex_knowledge_document(uuid) to authenticated, service_role;
