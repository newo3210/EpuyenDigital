-- Profiles guard: self-service limits and admin-only privileged columns (spec org-tenancy)
begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): org A (admin, two operators, inactive operator), org B (admin)
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Org A', 'org-a'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Org B', 'org-b');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'a.admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'a.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a4', 'a.op2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'a.inactive@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'b.admin@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active, updated_at) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Admin A', 'admin', true, '2020-01-01'),
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A', 'operator', true, '2020-01-01'),
  ('00000000-0000-4000-8000-0000000000a4', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A2', 'operator', true, '2020-01-01'),
  ('00000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-000000000001', 'Inactivo A', 'operator', false, '2020-01-01'),
  ('00000000-0000-4000-8000-0000000000b2', 'bbbbbbbb-0000-4000-8000-000000000001', 'Admin B', 'admin', true, '2020-01-01');

-- ---------------------------------------------------------------------------
-- Operator self-service
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$update public.profiles set full_name = 'Ana Pérez', avatar_path = 'a/b/c.png' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'operator can update own full_name and avatar_path'
);
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'P0001', 'forbidden_column',
  'operator cannot change own role'
);
select throws_ok(
  $$update public.profiles set org_id = 'bbbbbbbb-0000-4000-8000-000000000001' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'P0001', 'forbidden_column',
  'operator cannot change own org_id'
);
select throws_ok(
  $$update public.profiles set is_active = false where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'P0001', 'forbidden_column',
  'operator cannot change own is_active'
);
select results_eq(
  $$with u as (update public.profiles set full_name = 'Hacked' where id = '00000000-0000-4000-8000-0000000000a4' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'operator updating another operator of the same org affects zero rows'
);

reset role;

select results_eq(
  $$select full_name, role::text from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'$$,
  $$values ('Ana Pérez'::text, 'operator'::text)$$,
  'operator name changed and role remained operator'
);

-- ---------------------------------------------------------------------------
-- Inactive operator cannot self-update
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$with u as (update public.profiles set full_name = 'Reactivado' where id = '00000000-0000-4000-8000-0000000000a3' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'inactive operator updating own name affects zero rows'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin of the same organization
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$update public.profiles set role = 'area_lead' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'admin can change the role of an operator of the same org'
);
select lives_ok(
  $$update public.profiles set is_active = false where id = '00000000-0000-4000-8000-0000000000a4'$$,
  'admin can deactivate an operator of the same org'
);
select lives_ok(
  $$update public.profiles set full_name = 'Operador Renombrado' where id = '00000000-0000-4000-8000-0000000000a3'$$,
  'admin can rename an operator of the same org'
);
select throws_ok(
  $$update public.profiles set org_id = 'bbbbbbbb-0000-4000-8000-000000000001' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  '42501', null,
  'admin cannot move a profile to another organization'
);
select lives_ok(
  $$update public.profiles set avatar_path = 'x/y/z.webp' where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'admin can update own avatar_path'
);

reset role;

select results_eq(
  $$select id, role::text, is_active from public.profiles where id in ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4') order by id$$,
  $$values ('00000000-0000-4000-8000-0000000000a2'::uuid, 'area_lead'::text, true), ('00000000-0000-4000-8000-0000000000a4'::uuid, 'operator'::text, false)$$,
  'admin changes to role and is_active were persisted'
);
select ok(
  (select updated_at > '2021-01-01'::timestamptz from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'),
  'updated_at is maintained by trigger'
);

-- ---------------------------------------------------------------------------
-- Admin of another organization
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$with u as (update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000a2' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'admin of org B changing a profile of org A affects zero rows'
);

reset role;

select is(
  (select role::text from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'),
  'area_lead',
  'cross-org admin attempt left the role unchanged'
);

select * from finish();

rollback;
