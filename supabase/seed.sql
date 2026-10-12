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
