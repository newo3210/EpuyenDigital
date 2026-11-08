-- Tasks and notes: create history, support forbidden, cancel reason, sealed notes, external phone unique.
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into public.organizations (id, name, slug) values
  ('dddddddd-0000-4000-8000-0000000000aa', 'Org Tasks', 'org-tasks');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000t1', 'tasks.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000t2', 'tasks.support@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000t1', 'dddddddd-0000-4000-8000-0000000000aa', 'Operador T', 'operator', true),
  ('00000000-0000-4000-8000-0000000000t2', 'dddddddd-0000-4000-8000-0000000000aa', 'Soporte T', 'support', true);

insert into public.areas (id, org_id, name, is_default) values
  ('00000000-0000-4000-8000-0000000000a1', 'dddddddd-0000-4000-8000-0000000000aa', 'Mesa T', true);

insert into public.area_members (area_id, user_id, is_lead) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000t1', false);

insert into public.whatsapp_lines (id, org_id, name, display_phone, evolution_instance, status, default_area_id) values
  ('00000000-0000-4000-8000-0000000000l1', 'dddddddd-0000-4000-8000-0000000000aa', 'Linea T', '+5491100000011', 'tasks-line', 'disconnected', '00000000-0000-4000-8000-0000000000a1');

insert into public.citizens (id, org_id, full_name) values
  ('00000000-0000-4000-8000-0000000000c1', 'dddddddd-0000-4000-8000-0000000000aa', 'Vecino T');

insert into public.conversations (id, org_id, line_id, citizen_id, phone_normalized, area_id) values
  ('00000000-0000-4000-8000-0000000000v1', 'dddddddd-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000l1', '00000000-0000-4000-8000-0000000000c1', '5492944111000', '00000000-0000-4000-8000-0000000000a1');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000t1","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select result_hint from public.create_task(
    '00000000-0000-4000-8000-0000000000v1',
    'Luminaria',
    'en la esquina',
    'complaint',
    2,
    'self',
    null, null, null, null, false, null
  )),
  'ok',
  'create task returns ok'
);

select is(
  (select count(*)::int from public.task_history where event = 'CREATED'),
  1,
  'create writes CREATED history'
);

select throws_ok(
  $$select * from public.cancel_task(
    (select id from public.tasks limit 1),
    null,
    null
  )$$,
  'P0001',
  'CANCEL_REASON_REQUIRED',
  'cancel without reason fails'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000t2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.create_task(
    '00000000-0000-4000-8000-0000000000v1',
    'Hack',
    null,
    'other',
    3,
    'self',
    null, null, null, null, false, null
  )$$,
  'P0001',
  'FORBIDDEN',
  'support cannot create a task'
);
reset role;

select lives_ok(
  $$select public.seal_audit_note(
    'dddddddd-0000-4000-8000-0000000000aa',
    'cierre',
    '00000000-0000-4000-8000-0000000000v1',
    '00000000-0000-4000-8000-0000000000c1',
    null,
    'corr-1'
  )$$,
  'seal_audit_note inserts'
);

select throws_ok(
  $$update public.notes set body = 'hack' where sealed_at is not null$$,
  'P0001',
  'SEALED',
  'sealed notes reject update'
);

insert into public.external_contacts (org_id, area_id, full_name, phone_normalized) values
  ('dddddddd-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a1', 'Externo', '5492944222000');

select throws_ok(
  $$insert into public.external_contacts (org_id, area_id, full_name, phone_normalized) values
    ('dddddddd-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000a1', 'Otro', '5492944222000')$$,
  '23505',
  null,
  'external phone is unique per org'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000t1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$update public.tasks set title = 'hack' where true$$,
  '42501',
  null,
  'authenticated cannot update tasks directly'
);
reset role;

select * from finish();
rollback;
