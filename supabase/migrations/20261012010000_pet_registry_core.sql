-- Pet registry core schema - organizations, citizens, animals, sessions, jobs, media

create extension if not exists "pgcrypto";

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- org_settings
create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  send_mode text not null default 'dry_run'
    check (send_mode in ('dry_run', 'allowlist', 'production')),
  allowlist_phones text[] not null default '{}',
  registration_session_ttl_hours int not null default 24,
  privacy_notice_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_settings_set_updated_at
before update on public.org_settings
for each row execute function public.set_updated_at();

-- whatsapp_lines
create table if not exists public.whatsapp_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  display_phone text not null,
  evolution_base_url text,
  evolution_instance text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger whatsapp_lines_set_updated_at
before update on public.whatsapp_lines
for each row execute function public.set_updated_at();

-- whatsapp_line_secrets (service role only — RLS on, no policies)
create table if not exists public.whatsapp_line_secrets (
  line_id uuid primary key references public.whatsapp_lines(id) on delete cascade,
  webhook_secret text,
  api_key_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger whatsapp_line_secrets_set_updated_at
before update on public.whatsapp_line_secrets
for each row execute function public.set_updated_at();

-- citizens
create table if not exists public.citizens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  document_id text,
  address_line text,
  neighborhood text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  privacy_consent_at timestamptz,
  privacy_notice_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger citizens_set_updated_at
before update on public.citizens
for each row execute function public.set_updated_at();

create index if not exists citizens_org_document_idx
  on public.citizens (org_id, document_id);

-- citizen_phones unique (org_id, phone_normalized)
create table if not exists public.citizen_phones (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  citizen_id uuid not null references public.citizens(id) on delete cascade,
  phone_normalized text not null,
  created_at timestamptz not null default now(),
  unique (org_id, phone_normalized)
);

-- animals
create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  citizen_id uuid not null references public.citizens(id) on delete cascade,
  name text not null,
  species text not null check (species in ('dog', 'cat', 'other')),
  sex text not null check (sex in ('male', 'female')),
  breed_color text not null,
  size text not null check (size in ('small', 'medium', 'large')),
  age_stage text not null,
  sterilized text not null check (sterilized in ('yes', 'no', 'unknown')),
  rabies_status text not null check (rabies_status in ('up_to_date', 'pending')),
  microchip text,
  municipal_id text not null,
  distinctive_traits jsonb,
  traits_status text not null default 'pending'
    check (traits_status in ('pending', 'ready', 'pending_manual')),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, municipal_id)
);

create trigger animals_set_updated_at
before update on public.animals
for each row execute function public.set_updated_at();

-- animal_photos
create table if not exists public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  kind text not null check (kind in ('animal', 'health_card')),
  storage_path text not null,
  message_id uuid,
  created_at timestamptz not null default now()
);

-- neighborhood_codes
create table if not exists public.neighborhood_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  neighborhood_normalized text not null,
  code text not null check (char_length(code) between 3 and 4),
  created_at timestamptz not null default now(),
  unique (org_id, neighborhood_normalized)
);

-- animal_id_counters
create table if not exists public.animal_id_counters (
  org_id uuid not null references public.organizations(id) on delete cascade,
  year int not null,
  last_seq int not null default 0,
  primary key (org_id, year)
);

-- registration_sessions
create table if not exists public.registration_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  line_id uuid not null references public.whatsapp_lines(id) on delete cascade,
  phone_normalized text not null,
  step text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (line_id, phone_normalized)
);

create trigger registration_sessions_set_updated_at
before update on public.registration_sessions
for each row execute function public.set_updated_at();

-- messages (minimal inbound/outbound log)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  line_id uuid not null references public.whatsapp_lines(id) on delete cascade,
  external_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  phone_normalized text not null,
  kind text not null,
  body text,
  media_url text,
  media_mime text,
  storage_path text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  delivery_status text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (line_id, external_id)
);

-- jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  job_type text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create index if not exists jobs_claim_idx
  on public.jobs (status, available_at)
  where status = 'pending';

-- RLS enable (service role bypasses; no public anon policies for MVP automation tables)
alter table public.organizations enable row level security;
alter table public.org_settings enable row level security;
alter table public.whatsapp_lines enable row level security;
alter table public.whatsapp_line_secrets enable row level security;
alter table public.citizens enable row level security;
alter table public.citizen_phones enable row level security;
alter table public.animals enable row level security;
alter table public.animal_photos enable row level security;
alter table public.neighborhood_codes enable row level security;
alter table public.animal_id_counters enable row level security;
alter table public.registration_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.jobs enable row level security;

-- Private storage bucket animal-media (Supabase Storage; no-op if schema absent)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('animal-media', 'animal-media', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- complete_animal_registration - atomic municipal ID + animal insert
create or replace function public.complete_animal_registration(
  p_org_id uuid,
  p_citizen_id uuid,
  p_name text,
  p_species text,
  p_sex text,
  p_breed_color text,
  p_size text,
  p_age_stage text,
  p_sterilized text,
  p_rabies_status text,
  p_microchip text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_neighborhood text default null
)
returns table (
  animal_id uuid,
  municipal_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int;
  v_seq int;
  v_code text;
  v_municipal_id text;
  v_animal_id uuid;
  v_norm text;
begin
  if p_species not in ('dog', 'cat', 'other') then
    raise exception 'INVALID_SPECIES';
  end if;

  v_year := extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::int;
  v_norm := upper(regexp_replace(coalesce(p_neighborhood, ''), '[^A-Za-z0-9]', '', 'g'));

  select nc.code into v_code
  from public.neighborhood_codes nc
  where nc.org_id = p_org_id
    and (
      nc.neighborhood_normalized = lower(trim(coalesce(p_neighborhood, '')))
      or nc.code = left(v_norm, 4)
    )
  limit 1;

  if v_code is null then
    v_code := 'EPU';
  end if;

  insert into public.animal_id_counters (org_id, year, last_seq)
  values (p_org_id, v_year, 0)
  on conflict (org_id, year) do nothing;

  select c.last_seq into v_seq
  from public.animal_id_counters c
  where c.org_id = p_org_id and c.year = v_year
  for update;

  v_seq := v_seq + 1;

  update public.animal_id_counters
  set last_seq = v_seq
  where org_id = p_org_id and year = v_year;

  v_municipal_id := v_code || '-' || v_year::text || '-' || lpad(v_seq::text, 5, '0');

  insert into public.animals (
    org_id, citizen_id, name, species, sex, breed_color, size, age_stage,
    sterilized, rabies_status, microchip, municipal_id, latitude, longitude,
    status, traits_status
  ) values (
    p_org_id, p_citizen_id, p_name, p_species, p_sex, p_breed_color, p_size, p_age_stage,
    p_sterilized, p_rabies_status, p_microchip, v_municipal_id, p_latitude, p_longitude,
    'active', 'pending'
  )
  returning id into v_animal_id;

  animal_id := v_animal_id;
  municipal_id := v_municipal_id;
  return next;
end;
$$;

revoke all on function public.complete_animal_registration(
  uuid, uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text
) from public;
grant execute on function public.complete_animal_registration(
  uuid, uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text
) to service_role;

-- claim_next_job - FOR UPDATE SKIP LOCKED consumer helper
create or replace function public.claim_next_job()
returns table (
  id uuid,
  payload jsonb,
  attempts int,
  max_attempts int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select j.id into v_id
  from public.jobs j
  where j.status = 'pending'
    and j.available_at <= now()
  order by j.created_at
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.jobs j
  set status = 'processing',
      attempts = j.attempts + 1,
      locked_at = now()
  where j.id = v_id
  returning j.id, j.payload, j.attempts, j.max_attempts;
end;
$$;

revoke all on function public.claim_next_job() from public;
grant execute on function public.claim_next_job() to service_role;
