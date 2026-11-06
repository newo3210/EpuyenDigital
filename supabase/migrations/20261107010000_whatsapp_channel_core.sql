-- WhatsApp channel core - conversations, line admin fields, encrypted secrets, message links.
-- Change: whatsapp-channel-core (Phase 2 - WA-01..12 channel layer)

-- ---------------------------------------------------------------------------
-- whatsapp_lines: Evolution URL already present; add default area + status metadata
-- ---------------------------------------------------------------------------
alter table public.whatsapp_lines
  add column if not exists default_area_id uuid references public.areas(id) on delete set null,
  add column if not exists last_status_at timestamptz;

comment on column public.whatsapp_lines.default_area_id is
  'Area assigned to new conversations on this line (shared line → Mesa de Entrada).';
comment on column public.whatsapp_lines.last_status_at is
  'Timestamp of the last connection test or CONNECTION_UPDATE.';

-- Normalize legacy pet-registry status values to line_status vocabulary.
update public.whatsapp_lines
set status = case
  when status in ('connected', 'disconnected', 'error') then status
  when status = 'active' then 'disconnected'
  else 'disconnected'
end
where status is distinct from case
  when status in ('connected', 'disconnected', 'error') then status
  when status = 'active' then 'disconnected'
  else 'disconnected'
end;

alter table public.whatsapp_lines
  alter column status set default 'disconnected';

alter table public.whatsapp_lines
  drop constraint if exists whatsapp_lines_status_check;

alter table public.whatsapp_lines
  add constraint whatsapp_lines_status_check
  check (status in ('connected', 'disconnected', 'error'));

create index if not exists whatsapp_lines_org_idx
  on public.whatsapp_lines (org_id);

create index if not exists whatsapp_lines_default_area_idx
  on public.whatsapp_lines (default_area_id)
  where default_area_id is not null;

-- ---------------------------------------------------------------------------
-- whatsapp_line_secrets: ciphertext for webhook secret (API key already ciphertext)
-- ---------------------------------------------------------------------------
alter table public.whatsapp_line_secrets
  add column if not exists webhook_secret_ciphertext text;

comment on column public.whatsapp_line_secrets.webhook_secret_ciphertext is
  'AES-256-GCM ciphertext for Evolution webhook secret (CREDENTIALS_ENCRYPTION_KEY).';
comment on column public.whatsapp_line_secrets.api_key_ciphertext is
  'AES-256-GCM ciphertext for Evolution API key (CREDENTIALS_ENCRYPTION_KEY).';
comment on column public.whatsapp_line_secrets.webhook_secret is
  'Legacy plaintext webhook secret; prefer webhook_secret_ciphertext. Kept for local seed/dev until fully migrated.';

-- Deny authenticated/anon direct access (service role bypasses RLS).
revoke all on table public.whatsapp_line_secrets from anon, authenticated;
grant all on table public.whatsapp_line_secrets to service_role;

-- ---------------------------------------------------------------------------
-- citizens: channel stub fields (POB-01 subset)
-- ---------------------------------------------------------------------------
alter table public.citizens
  add column if not exists registration_status text not null default 'unregistered',
  add column if not exists party_kind text not null default 'person',
  add column if not exists whatsapp_push_name text,
  add column if not exists whatsapp_avatar_url text,
  add column if not exists whatsapp_avatar_fetched_at timestamptz;

alter table public.citizens
  drop constraint if exists citizens_registration_status_check;
alter table public.citizens
  add constraint citizens_registration_status_check
  check (registration_status in ('unregistered', 'registered'));

alter table public.citizens
  drop constraint if exists citizens_party_kind_check;
alter table public.citizens
  add constraint citizens_party_kind_check
  check (party_kind in ('person', 'organization'));

comment on column public.citizens.whatsapp_push_name is
  'WhatsApp pushName captured on first contact; not a substitute for full_name.';
comment on column public.citizens.latitude is
  'Pet / home GPS from registration — never overwrite with mesa inquiry message pins.';

-- ---------------------------------------------------------------------------
-- conversations: one thread per (org, line, phone)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  line_id uuid not null references public.whatsapp_lines(id) on delete cascade,
  citizen_id uuid references public.citizens(id) on delete set null,
  phone_normalized text not null,
  area_id uuid not null references public.areas(id) on delete restrict,
  bot_state text not null default 'active'
    check (bot_state in ('active', 'handoff', 'paused')),
  queue_column text not null default 'new'
    check (queue_column in ('new', 'claimed', 'in_progress', 'waiting_external', 'resolved')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  delegated_from_user_id uuid references public.profiles(id) on delete set null,
  pending_area_id uuid references public.areas(id) on delete set null,
  awaiting_acceptance boolean not null default false,
  entered_queue_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  needs_response boolean not null default false,
  sla_due_at timestamptz,
  topic text,
  urgency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, line_id, phone_normalized)
);

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create index if not exists conversations_queue_idx
  on public.conversations (org_id, area_id, owner_user_id nulls first, entered_queue_at)
  where queue_column <> 'resolved';

create index if not exists conversations_line_phone_idx
  on public.conversations (line_id, phone_normalized);

-- ---------------------------------------------------------------------------
-- messages: link to conversations + delivery vocabulary
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists author_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists sender_kind text,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

alter table public.messages
  drop constraint if exists messages_delivery_status_check;
alter table public.messages
  add constraint messages_delivery_status_check
  check (
    delivery_status is null
    or delivery_status in (
      'pending', 'sent', 'delivered', 'read', 'failed', 'blocked', 'simulated'
    )
  );

-- Idempotency unique (line_id, external_id) already exists from pet registry.

-- ---------------------------------------------------------------------------
-- Backfill conversations from distinct message phones (safe: same line+phone)
-- ---------------------------------------------------------------------------
insert into public.conversations (
  org_id, line_id, phone_normalized, area_id, last_message_at, entered_queue_at
)
select
  m.org_id,
  m.line_id,
  m.phone_normalized,
  coalesce(
    wl.default_area_id,
    (
      select a.id
      from public.areas a
      where a.org_id = m.org_id and a.is_default
      order by a.created_at
      limit 1
    ),
    (
      select a.id
      from public.areas a
      where a.org_id = m.org_id
      order by a.created_at
      limit 1
    )
  ) as area_id,
  max(m.created_at) as last_message_at,
  min(m.created_at) as entered_queue_at
from public.messages m
join public.whatsapp_lines wl on wl.id = m.line_id
where m.phone_normalized ~ '^549\d+$'
  and exists (
    select 1 from public.areas a where a.org_id = m.org_id
  )
group by m.org_id, m.line_id, m.phone_normalized, wl.default_area_id
on conflict (org_id, line_id, phone_normalized) do nothing;

update public.messages m
set conversation_id = c.id
from public.conversations c
where m.conversation_id is null
  and c.org_id = m.org_id
  and c.line_id = m.line_id
  and c.phone_normalized = m.phone_normalized;

-- ---------------------------------------------------------------------------
-- Seed: Inspectoría line default_area_id → Mesa de Entrada (shared line)
-- ---------------------------------------------------------------------------
update public.whatsapp_lines wl
set default_area_id = a.id
from public.areas a
where wl.evolution_instance = 'inspectoria'
  and a.org_id = wl.org_id
  and a.name = 'Mesa de Entrada'
  and (wl.default_area_id is distinct from a.id);

-- ---------------------------------------------------------------------------
-- Storage bucket for inbound WhatsApp media (private)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'whatsapp-media',
      'whatsapp-media',
      false,
      20971520,
      array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac',
        'video/mp4', 'video/3gpp',
        'application/pdf',
        'application/octet-stream'
      ]
    )
    on conflict (id) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: conversations + messages (org-scoped; area tightening deferred to inbox)
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists conversations_select_org on public.conversations;
create policy conversations_select_org on public.conversations
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists conversations_insert_org on public.conversations;
create policy conversations_insert_org on public.conversations
  for insert to authenticated
  with check (org_id = public.current_org_id());

drop policy if exists conversations_update_org on public.conversations;
create policy conversations_update_org on public.conversations
  for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists messages_select_org on public.messages;
create policy messages_select_org on public.messages
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists messages_insert_org on public.messages;
create policy messages_insert_org on public.messages
  for insert to authenticated
  with check (org_id = public.current_org_id());

drop policy if exists messages_update_org on public.messages;
create policy messages_update_org on public.messages
  for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- Lines: org read; admin write
drop policy if exists whatsapp_lines_select_org on public.whatsapp_lines;
create policy whatsapp_lines_select_org on public.whatsapp_lines
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists whatsapp_lines_admin_insert on public.whatsapp_lines;
create policy whatsapp_lines_admin_insert on public.whatsapp_lines
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

drop policy if exists whatsapp_lines_admin_update on public.whatsapp_lines;
create policy whatsapp_lines_admin_update on public.whatsapp_lines
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  )
  with check (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );

drop policy if exists whatsapp_lines_admin_delete on public.whatsapp_lines;
create policy whatsapp_lines_admin_delete on public.whatsapp_lines
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
  );
