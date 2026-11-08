-- Citizen ficha: manual name, search isolation, merge, support cannot write.
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into public.organizations (id, name, slug) values
  ('cccccccc-0000-4000-8000-0000000000aa', 'Org A', 'org-a-citizens'),
  ('cccccccc-0000-4000-8000-0000000000bb', 'Org B', 'org-b-citizens');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'citizens.a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'citizens.b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c3', 'citizens.support@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000c1', 'cccccccc-0000-4000-8000-0000000000aa', 'Operador A', 'operator', true),
  ('00000000-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-0000000000bb', 'Operador B', 'operator', true),
  ('00000000-0000-4000-8000-0000000000c3', 'cccccccc-0000-4000-8000-0000000000aa', 'Soporte', 'support', true);

insert into public.areas (id, org_id, name, is_default) values
  ('00000000-0000-4000-8000-0000000000e1', 'cccccccc-0000-4000-8000-0000000000aa', 'Mesa A', true),
  ('00000000-0000-4000-8000-0000000000e2', 'cccccccc-0000-4000-8000-0000000000bb', 'Mesa B', true);

insert into public.whatsapp_lines (id, org_id, name, display_phone, evolution_instance, status, default_area_id) values
  ('00000000-0000-4000-8000-0000000000f1', 'cccccccc-0000-4000-8000-0000000000aa', 'Linea A', '+5491100000091', 'citizens-a', 'disconnected', '00000000-0000-4000-8000-0000000000e1');

insert into public.citizens (id, org_id, full_name, document_id, field_sources, party_kind) values
  ('00000000-0000-4000-8000-0000000000d1', 'cccccccc-0000-4000-8000-0000000000aa', 'Ana', '30111222', '{"full_name":"manual"}', 'person'),
  ('00000000-0000-4000-8000-0000000000d2', 'cccccccc-0000-4000-8000-0000000000aa', 'Beto', '30999888', '{}', 'person'),
  ('00000000-0000-4000-8000-0000000000d3', 'cccccccc-0000-4000-8000-0000000000bb', 'Carla', '40111222', '{}', 'person');

insert into public.citizen_phones (id, org_id, citizen_id, phone_normalized) values
  ('00000000-0000-4000-8000-0000000000p1', 'cccccccc-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000d1', '5492944000001'),
  ('00000000-0000-4000-8000-0000000000p2', 'cccccccc-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000d2', '5492944000002');

insert into public.conversations (id, org_id, line_id, citizen_id, phone_normalized, area_id) values
  ('00000000-0000-4000-8000-0000000000v1', 'cccccccc-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000d2', '5492944000002', '00000000-0000-4000-8000-0000000000e1');

update public.citizens set full_name = 'Bot' where id = '00000000-0000-4000-8000-0000000000d1';

select is(
  (select full_name from public.citizens where id = '00000000-0000-4000-8000-0000000000d1'),
  'Ana',
  'manual name survives a non-operator update'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.search_citizens('Ana')),
  0,
  'other org search is empty'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select result_hint from public.merge_citizens(
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d2',
    'mismo vecino'
  )),
  'ok',
  'merge returns ok'
);
select is(
  (select citizen_id from public.citizen_phones where id = '00000000-0000-4000-8000-0000000000p2'),
  '00000000-0000-4000-8000-0000000000d1'::uuid,
  'merge moves the phone'
);
select is(
  (select citizen_id from public.conversations where id = '00000000-0000-4000-8000-0000000000v1'),
  '00000000-0000-4000-8000-0000000000d1'::uuid,
  'merge moves the conversation'
);
select throws_ok(
  $$select * from public.merge_citizens(
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d2',
    'otra vez'
  )$$,
  'P0001',
  'NOT_FOUND',
  'second merge of the same drop fails'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.update_citizen_profile(
    '00000000-0000-4000-8000-0000000000d1',
    'Hack', null, null, null, null, null, null, 'person', null, null
  )$$,
  'P0001',
  'FORBIDDEN',
  'support cannot update a profile'
);
reset role;

select * from finish();
rollback;
