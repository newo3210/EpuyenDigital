-- Seed - epuyen org, Inspectoría line, neighborhood codes

insert into public.organizations (id, name, slug, timezone)
values (
  '00000000-0000-4000-8000-000000000001',
  'Municipalidad de Epuyén',
  'epuyen',
  'America/Argentina/Buenos_Aires'
)
on conflict (slug) do nothing;

insert into public.org_settings (
  org_id, send_mode, allowlist_phones, registration_session_ttl_hours, privacy_notice_version
) values (
  '00000000-0000-4000-8000-000000000001',
  'dry_run',
  array['5492944216586'],
  24,
  'v1'
)
on conflict (org_id) do update set
  send_mode = excluded.send_mode,
  allowlist_phones = excluded.allowlist_phones;

insert into public.whatsapp_lines (
  id, org_id, name, display_phone, evolution_instance, status
) values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Inspectoría',
  '+5492944216586',
  'inspectoria',
  'active'
)
on conflict (evolution_instance) do nothing;

insert into public.whatsapp_line_secrets (line_id, webhook_secret)
values (
  '00000000-0000-4000-8000-000000000002',
  'dev-webhook-secret-change-me'
)
on conflict (line_id) do update set webhook_secret = excluded.webhook_secret;

insert into public.neighborhood_codes (org_id, neighborhood_normalized, code)
values
  ('00000000-0000-4000-8000-000000000001', 'centro', 'CENT'),
  ('00000000-0000-4000-8000-000000000001', 'epuyen', 'EPU')
on conflict (org_id, neighborhood_normalized) do nothing;

-- Areas - Mesa de Entrada (default hub) + Inspectoría; fixed UUIDs shared with seed.ts
insert into public.areas (id, org_id, name, description, color, is_active, is_default)
values
  (
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000001',
    'Mesa de Entrada',
    'Área hub de triage municipal',
    '#1f6f5c',
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    'Inspectoría',
    'Registro de mascotas y fiscalización',
    '#185a4b',
    true,
    false
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  is_active = excluded.is_active,
  is_default = excluded.is_default;

-- Link Inspectoria WhatsApp line to Inspectoría area
update public.whatsapp_lines
set default_area_id = '00000000-0000-4000-8000-000000000011'
where id = '00000000-0000-4000-8000-000000000002';

-- Seed admin membership in both areas (when the admin profile already exists from db:seed)
insert into public.area_members (area_id, user_id, is_lead)
select a.area_id, p.id, a.is_lead
from (
  values
    ('00000000-0000-4000-8000-000000000010'::uuid, true),
    ('00000000-0000-4000-8000-000000000011'::uuid, false)
) as a(area_id, is_lead)
cross join lateral (
  select id from public.profiles
  where org_id = '00000000-0000-4000-8000-000000000001'
    and role = 'admin'
    and is_active
  order by created_at
  limit 1
) p
on conflict (area_id, user_id) do update set is_lead = excluded.is_lead;
