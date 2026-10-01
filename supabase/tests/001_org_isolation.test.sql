-- Org isolation: RLS helpers and cross-organization read/write isolation (spec org-tenancy)
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, bypassing RLS)
--   org A: admin, active operator, inactive operator
--   org B: active operator
--   auth user without profile
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Org A', 'org-a'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Org B', 'org-b');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'a.admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'a.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'a.inactive@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b1', 'b.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c1', 'no.profile@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Admin A', 'admin', true),
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-000000000001', 'Inactivo A', 'operator', false),
  ('00000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000001', 'Operador B', 'operator', true);

-- ---------------------------------------------------------------------------
-- Schema guarantees
-- ---------------------------------------------------------------------------
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.organizations'::regclass, 'public.profiles'::regclass, 'public.error_logs'::regclass)),
  'RLS is enabled on organizations, profiles and error_logs'
);
select has_function('public', 'current_org_id', 'current_org_id() exists');
select has_function('public', 'current_user_role', 'current_user_role() exists');

-- ---------------------------------------------------------------------------
-- Active operator of org A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

select is(public.current_org_id(), 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'active operator: current_org_id() returns own org');
select is(public.current_user_role(), 'operator'::public.user_role, 'active operator: current_user_role() returns operator');
select is((select count(*)::int from public.profiles), 3, 'active operator sees the 3 profiles of org A');
select is((select count(*)::int from public.profiles where org_id <> 'aaaaaaaa-0000-4000-8000-000000000001'), 0, 'active operator sees no profile of org B');
select results_eq(
  'select id from public.organizations',
  $$values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid)$$,
  'active operator sees only its own organization'
);
select results_eq(
  $$with u as (update public.profiles set full_name = 'Hacked' where id = '00000000-0000-4000-8000-0000000000b1' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'active operator updating a profile of org B affects zero rows'
);
select results_eq(
  $$with u as (update public.organizations set name = 'Hacked' where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'active operator updating organization B affects zero rows'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin of org A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$with u as (update public.profiles set full_name = 'Hacked' where id = '00000000-0000-4000-8000-0000000000b1' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'admin of org A updating a profile of org B affects zero rows'
);
select throws_ok(
  $$insert into public.profiles (id, org_id, full_name) values ('00000000-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Nuevo')$$,
  '42501', null,
  'admin cannot insert profiles from the client (service role only)'
);
select results_eq(
  $$with d as (delete from public.profiles where id = '00000000-0000-4000-8000-0000000000a2' returning 1) select count(*)::int from d$$,
  $$values (0)$$,
  'admin cannot delete profiles from the client (service role only)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Inactive operator of org A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;

select is(public.current_org_id(), null::uuid, 'inactive operator: current_org_id() returns null');
select is(public.current_user_role(), null::public.user_role, 'inactive operator: current_user_role() returns null');
select is((select count(*)::int from public.profiles), 0, 'inactive operator sees zero profiles');
select is((select count(*)::int from public.organizations), 0, 'inactive operator sees zero organizations');
select is((select count(*)::int from public.error_logs), 0, 'inactive operator sees zero error logs');

reset role;

-- ---------------------------------------------------------------------------
-- Operator of org B and auth user without profile
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  'select id from public.profiles',
  $$values ('00000000-0000-4000-8000-0000000000b1'::uuid)$$,
  'operator of org B sees only its own org profiles'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

select is(public.current_org_id(), null::uuid, 'user without profile: current_org_id() returns null');
select is(public.current_user_role(), null::public.user_role, 'user without profile: current_user_role() returns null');
select is((select count(*)::int from public.profiles), 0, 'user without profile sees zero profiles');

reset role;

select * from finish();

rollback;
