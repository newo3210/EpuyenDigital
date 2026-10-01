-- Error logs: service-role inserts, support/admin access, status-only updates, 30-day purge (spec error-tracking)
begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): org A (admin, support, operator), org B (support), five error rows
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Org A', 'org-a'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Org B', 'org-b');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'a.admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a5', 'a.support@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'a.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b5', 'b.support@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Admin A', 'admin'),
  ('00000000-0000-4000-8000-0000000000a5', 'aaaaaaaa-0000-4000-8000-000000000001', 'Soporte A', 'support'),
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A', 'operator'),
  ('00000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-0000-4000-8000-000000000001', 'Soporte B', 'support');

insert into public.error_logs (id, org_id, source, level, message, trace_id, created_at) values
  ('eeeeeeee-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001', 'web', 'error', 'A open', 'trace-a-0001', now()),
  ('eeeeeeee-0000-4000-8000-00000000000b', 'bbbbbbbb-0000-4000-8000-000000000001', 'api', 'warn', 'B open', 'trace-b-0001', now()),
  ('eeeeeeee-0000-4000-8000-00000000000c', null, 'worker', 'error', 'No org', 'trace-n-0001', now()),
  ('eeeeeeee-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-000000000001', 'db', 'info', 'A old', 'trace-a-0002', now() - interval '31 days'),
  ('eeeeeeee-0000-4000-8000-0000000000d2', 'aaaaaaaa-0000-4000-8000-000000000001', 'db', 'info', 'A recent', 'trace-a-0003', now() - interval '29 days');

select is(
  (select status::text from public.error_logs where id = 'eeeeeeee-0000-4000-8000-00000000000a'),
  'open',
  'new error logs default to status open'
);

-- ---------------------------------------------------------------------------
-- Operator: no insert, no read, no update
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$insert into public.error_logs (org_id, source, level, message, trace_id) values ('aaaaaaaa-0000-4000-8000-000000000001', 'web', 'error', 'x', 'trace-x-0001')$$,
  '42501', null,
  'authenticated insert into error_logs is rejected'
);
select is((select count(*)::int from public.error_logs), 0, 'operator cannot select error logs');
select results_eq(
  $$with u as (update public.error_logs set status = 'resolved' where id = 'eeeeeeee-0000-4000-8000-00000000000a' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'operator updating an error log affects zero rows'
);
select throws_ok(
  'select public.purge_error_logs()',
  '42501', null,
  'authenticated users cannot execute purge_error_logs()'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin of org A: own org rows only (no null-org rows)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.error_logs), 3, 'admin of org A sees the 3 rows of org A');
select is((select count(*)::int from public.error_logs where org_id is null), 0, 'admin does not see rows without organization');

reset role;

-- ---------------------------------------------------------------------------
-- Support of org A: own org rows plus null-org rows; status workflow
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.error_logs), 4, 'support of org A sees org A rows and rows without organization');
select is((select count(*)::int from public.error_logs where org_id = 'bbbbbbbb-0000-4000-8000-000000000001'), 0, 'support of org A does not see org B rows');

select lives_ok(
  $$update public.error_logs set status = 'acknowledged' where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  'support can acknowledge an error'
);
select results_eq(
  $$select status::text, resolved_by, resolved_at from public.error_logs where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  $$values ('acknowledged'::text, null::uuid, null::timestamptz)$$,
  'acknowledged error has no resolution stamp'
);

select lives_ok(
  $$update public.error_logs set status = 'resolved', resolved_by = '00000000-0000-4000-8000-0000000000a1' where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  'support can resolve an error'
);
select results_eq(
  $$select status::text, resolved_by, resolved_at is not null from public.error_logs where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  $$values ('resolved'::text, '00000000-0000-4000-8000-0000000000a5'::uuid, true)$$,
  'resolve stamps resolved_by with the caller (ignoring client value) and sets resolved_at'
);

select lives_ok(
  $$update public.error_logs set status = 'open' where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  'support can reopen an error'
);
select results_eq(
  $$select status::text, resolved_by, resolved_at from public.error_logs where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  $$values ('open'::text, null::uuid, null::timestamptz)$$,
  'reopen clears the resolution stamp'
);

select throws_ok(
  $$update public.error_logs set message = 'edited' where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  'P0001', 'forbidden_column',
  'changing the message of an error is rejected'
);
select throws_ok(
  $$update public.error_logs set details = '{"x":1}', status = 'acknowledged' where id = 'eeeeeeee-0000-4000-8000-00000000000a'$$,
  'P0001', 'forbidden_column',
  'changing details together with status is rejected'
);
select lives_ok(
  $$update public.error_logs set status = 'acknowledged' where id = 'eeeeeeee-0000-4000-8000-00000000000c'$$,
  'support can change the status of an error without organization'
);

reset role;

-- ---------------------------------------------------------------------------
-- Support of org B cannot touch org A rows
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b5","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$with u as (update public.error_logs set status = 'resolved' where id = 'eeeeeeee-0000-4000-8000-00000000000a' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'support of org B updating an org A error affects zero rows'
);

reset role;

-- ---------------------------------------------------------------------------
-- Retention purge (as postgres / service role)
-- ---------------------------------------------------------------------------
select is(public.purge_error_logs(), 1, 'purge_error_logs() deletes exactly the row older than 30 days');
select results_eq(
  $$select id from public.error_logs where id in ('eeeeeeee-0000-4000-8000-0000000000d1', 'eeeeeeee-0000-4000-8000-0000000000d2')$$,
  $$values ('eeeeeeee-0000-4000-8000-0000000000d2'::uuid)$$,
  'the 29-day-old row remains after purge'
);

select * from finish();

rollback;
