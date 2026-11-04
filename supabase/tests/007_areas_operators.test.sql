-- Areas / operators: isolation, last_admin, default uniqueness, operator_area_ids
begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures (postgres, bypass RLS)
--   org A: sole admin, second admin, operator; Mesa + Inspectoría + extra area
--   org B: operator + one area
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Org A', 'org-a-areas'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Org B', 'org-b-areas');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'a.admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a5', 'a.admin2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'a.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b1', 'b.op@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Admin A', 'admin', true),
  ('00000000-0000-4000-8000-0000000000a5', 'aaaaaaaa-0000-4000-8000-000000000001', 'Admin A2', 'admin', true),
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A', 'operator', true),
  ('00000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000001', 'Operador B', 'operator', true);

insert into public.areas (id, org_id, name, color, is_active, is_default) values
  ('aaaaaaaa-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000001', 'Mesa de Entrada', '#1f6f5c', true, true),
  ('aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000001', 'Inspectoría', '#185a4b', true, false),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'aaaaaaaa-0000-4000-8000-000000000001', 'Obras', '#13463a', true, false),
  ('bbbbbbbb-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000001', 'Mesa B', '#1f6f5c', true, true);

insert into public.area_members (area_id, user_id, is_lead) values
  ('aaaaaaaa-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000a1', true),
  ('aaaaaaaa-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a1', false),
  ('aaaaaaaa-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000a2', false),
  ('aaaaaaaa-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a2', false),
  ('bbbbbbbb-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000b1', false);

-- ---------------------------------------------------------------------------
-- Schema guarantees
-- ---------------------------------------------------------------------------
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.areas'::regclass, 'public.area_members'::regclass)),
  'RLS is enabled on areas and area_members'
);
select has_function('public', 'operator_area_ids', 'operator_area_ids() exists');
select has_function('public', 'set_default_area', array['uuid'], 'set_default_area(uuid) exists');
select ok(
  not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conversations'),
  'conversations table remains absent'
);
select has_column('public', 'profiles', 'deactivated_at', 'profiles.deactivated_at exists');
select has_column('public', 'whatsapp_lines', 'default_area_id', 'whatsapp_lines.default_area_id exists');

-- ---------------------------------------------------------------------------
-- Default-area uniqueness (partial unique index)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.areas (org_id, name, is_default) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Otra default', true)$$,
  '23505', null,
  'second default area in the same org is rejected'
);

select has_function(
  'public',
  'areas_guard_default_clear',
  'areas_guard_default_clear() exists'
);

-- ---------------------------------------------------------------------------
-- Cross-org area isolation (operator A)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.areas), 2, 'operator A sees only the two areas they belong to');
select is(
  (select count(*)::int from public.areas where org_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0,
  'operator A sees no areas of org B'
);
select throws_ok(
  $$insert into public.areas (org_id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Hack')$$,
  '42501', null,
  'operator cannot insert areas'
);
select results_eq(
  $$with u as (update public.areas set name = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-000000000010' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'operator updating an area affects zero rows'
);

select results_eq(
  $$select area_id from public.operator_area_ids() order by 1$$,
  $$values ('aaaaaaaa-0000-4000-8000-000000000010'::uuid), ('aaaaaaaa-0000-4000-8000-000000000011'::uuid)$$,
  'operator_area_ids returns exactly the two memberships'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin of org A: sees all org areas; cannot see org B; set_default_area
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.areas), 3, 'admin A sees all three areas of org A');
select lives_ok(
  $$select public.set_default_area('aaaaaaaa-0000-4000-8000-000000000011')$$,
  'admin can set Inspectoría as default via RPC'
);

select throws_ok(
  $$update public.areas set is_default = false where id = 'aaaaaaaa-0000-4000-8000-000000000011'$$,
  'P0001', 'cannot_clear_default',
  'admin cannot clear the last default via direct update'
);

reset role;

select results_eq(
  $$select id, is_default from public.areas where org_id = 'aaaaaaaa-0000-4000-8000-000000000001' and name in ('Mesa de Entrada', 'Inspectoría') order by name$$,
  $$values
    ('aaaaaaaa-0000-4000-8000-000000000011'::uuid, true),
    ('aaaaaaaa-0000-4000-8000-000000000010'::uuid, false)
  $$,
  'set_default_area cleared Mesa and marked Inspectoría'
);

-- Restore Mesa as default for remaining tests (postgres role bypasses clear guard)
update public.areas set is_default = false where id = 'aaaaaaaa-0000-4000-8000-000000000011';
update public.areas set is_default = true where id = 'aaaaaaaa-0000-4000-8000-000000000010';

-- ---------------------------------------------------------------------------
-- Last-admin protection
-- ---------------------------------------------------------------------------
-- Demote second admin first so a1 becomes sole admin, then try demoting a1.
update public.profiles
set role = 'operator'
where id = '00000000-0000-4000-8000-0000000000a5';

select throws_ok(
  $$update public.profiles set role = 'operator' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'P0001', 'last_admin',
  'cannot demote the last active admin'
);
select throws_ok(
  $$update public.profiles set is_active = false where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'P0001', 'last_admin',
  'cannot deactivate the last active admin'
);

-- With a second active admin, demote/deactivate of a1 is allowed.
update public.profiles
set role = 'admin', is_active = true
where id = '00000000-0000-4000-8000-0000000000a5';

select lives_ok(
  $$update public.profiles set is_active = false where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'can deactivate an admin when another active admin remains'
);

select results_eq(
  $$select is_active, deactivated_at is not null from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values (false, true)$$,
  'deactivated_at is set when is_active becomes false'
);

select lives_ok(
  $$update public.profiles set is_active = true where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'can reactivate a previously deactivated admin'
);

select results_eq(
  $$select is_active, deactivated_at from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'$$,
  $$values (true, null::timestamptz)$$,
  'deactivated_at is cleared on reactivate'
);

-- ---------------------------------------------------------------------------
-- Membership assign/remove as admin (RLS)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.area_members (area_id, user_id, is_lead)
    values ('aaaaaaaa-0000-4000-8000-000000000012', '00000000-0000-4000-8000-0000000000a2', false)$$,
  'admin can assign membership'
);
select lives_ok(
  $$delete from public.area_members
    where area_id = 'aaaaaaaa-0000-4000-8000-000000000012'
      and user_id = '00000000-0000-4000-8000-0000000000a2'$$,
  'admin can remove membership'
);

reset role;

select * from finish();

rollback;
