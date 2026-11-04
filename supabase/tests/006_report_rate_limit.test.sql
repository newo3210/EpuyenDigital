-- Client report rate limit (design D12): origin column, partial index, atomic insert function
begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): one org, three operators
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Org A', 'org-a');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'a1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'a2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'a3@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a4', 'a4@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador Uno', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador Dos', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador Tres', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a4', 'aaaaaaaa-0000-4000-8000-000000000001', 'Soporte', 'support', true);

-- ---------------------------------------------------------------------------
-- Schema: origin column, partial index, function privileges
-- ---------------------------------------------------------------------------
select has_column('public', 'error_logs', 'origin', 'error_logs has an origin column');
select col_not_null('public', 'error_logs', 'origin', 'origin is not null');
insert into public.error_logs (source, level, message, trace_id)
values ('web', 'error', 'server row', 'trace-server-default');
select is(
  (select origin from public.error_logs where trace_id = 'trace-server-default'),
  'server',
  'origin defaults to server'
);
select throws_ok(
  $$insert into public.error_logs (source, level, message, trace_id, origin) values ('web', 'error', 'x', 'trace-bad-origin', 'browser')$$,
  '23514', null,
  'origin accepts only server or client'
);
select has_index('public', 'error_logs', 'error_logs_client_reports_idx', 'error_logs has the client-report partial index');
select hasnt_index('public', 'error_logs', 'error_logs_user_created_idx', 'the unfiltered per-user index is replaced');
select ok(
  not has_function_privilege('authenticated', 'public.insert_client_error_report(uuid, uuid, text, text, jsonb, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.insert_client_error_report(uuid, uuid, text, text, jsonb, integer, integer)', 'execute'),
  'authenticated and anon cannot call insert_client_error_report'
);
select ok(
  has_function_privilege('service_role', 'public.insert_client_error_report(uuid, uuid, text, text, jsonb, integer, integer)', 'execute'),
  'service_role can call insert_client_error_report'
);

-- ---------------------------------------------------------------------------
-- Limit (spec error-tracking: Report flood / Maximum-size reports still count)
-- ---------------------------------------------------------------------------
set local role service_role;

select is(
  (select count(*)::int from generate_series(1, 10) as attempt
   where public.insert_client_error_report(
     'aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1',
     'trace-' || attempt, 'boom', '{"truncated": true, "preview": "x"}'::jsonb, 10, 60
   ) is not null),
  10,
  'the first 10 reports in the window are stored, even with truncated details'
);
select is(
  public.insert_client_error_report(
    'aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1',
    'trace-11', 'boom', '{}'::jsonb, 10, 60
  ),
  null,
  'the 11th report in the window is rejected with null'
);
select is(
  (select count(*)::int from public.error_logs
   where user_id = '00000000-0000-4000-8000-0000000000a1' and origin = 'client'),
  10,
  'exactly 10 client rows are stored for the user'
);
select results_eq(
  $$select source, level::text, origin, org_id, message, details from public.error_logs where trace_id = 'trace-1'$$,
  $$values ('web'::text, 'error'::text, 'client'::text, 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'boom'::text, '{"truncated": true, "preview": "x"}'::jsonb)$$,
  'stored client rows carry source web, level error, origin client, org and details'
);
select isnt(
  public.insert_client_error_report(
    'aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2',
    'trace-other-user', 'boom', '{}'::jsonb, 10, 60
  ),
  null,
  'the limit is per user'
);

reset role;

-- Server rows and rows outside the window do not count toward the limit.
insert into public.error_logs (source, level, message, trace_id, user_id, org_id)
select 'web', 'error', 'server', 'trace-server-' || n, '00000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-000000000001'
from generate_series(1, 20) as n;
insert into public.error_logs (source, level, message, trace_id, user_id, org_id, origin, created_at)
select 'web', 'error', 'old', 'trace-old-' || n, '00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'client', now() - interval '2 minutes'
from generate_series(1, 20) as n;

set local role service_role;

select isnt(
  public.insert_client_error_report(
    'aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3',
    'trace-a3', 'boom', '{}'::jsonb, 10, 60
  ),
  null,
  'server-origin rows do not count toward the client limit'
);
select is(
  (select count(*)::int from generate_series(1, 9) as attempt
   where public.insert_client_error_report(
     'aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2',
     'trace-a2-' || attempt, 'boom', '{}'::jsonb, 10, 60
   ) is not null),
  9,
  'rows older than the window do not count (user 2 had 1 recent + 20 old)'
);
select is(
  public.insert_client_error_report(
    'aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2',
    'trace-a2-over', 'boom', '{}'::jsonb, 10, 60
  ),
  null,
  'user 2 is rejected once 10 recent client rows exist'
);

-- Invalid arguments (design D13, spec error-tracking "Invalid limit arguments")
select throws_ok(
  $$select public.insert_client_error_report('aaaaaaaa-0000-4000-8000-000000000001', null, 't-null-user', 'x', '{}'::jsonb, 10, 60)$$,
  '22023', 'invalid_argument',
  'a null user is rejected'
);
select throws_ok(
  $$select public.insert_client_error_report('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 't-null-limit', 'x', '{}'::jsonb, null, 60)$$,
  '22023', 'invalid_argument',
  'a null limit is rejected'
);
select throws_ok(
  $$select public.insert_client_error_report('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 't-zero-limit', 'x', '{}'::jsonb, 0, 60)$$,
  '22023', 'invalid_argument',
  'a zero limit is rejected'
);
select throws_ok(
  $$select public.insert_client_error_report('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 't-null-window', 'x', '{}'::jsonb, 10, null)$$,
  '22023', 'invalid_argument',
  'a null window is rejected'
);
select throws_ok(
  $$select public.insert_client_error_report('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 't-negative-window', 'x', '{}'::jsonb, 10, -5)$$,
  '22023', 'invalid_argument',
  'a negative window is rejected'
);
select throws_ok(
  $$select public.insert_client_error_report('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 't-zero-window', 'x', '{}'::jsonb, 10, 0)$$,
  '22023', 'invalid_argument',
  'a zero window is rejected'
);
select throws_ok(
  $$select public.insert_client_error_report('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 't-negative-limit', 'x', '{}'::jsonb, -1, 60)$$,
  '22023', 'invalid_argument',
  'a negative limit is rejected'
);
select is(
  (select count(*)::int from public.error_logs where trace_id like 't-%'),
  0,
  'rejected calls store nothing'
);

reset role;

-- ---------------------------------------------------------------------------
-- Guard: support can change status but never origin (rows could otherwise leave the count)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$update public.error_logs set origin = 'server' where trace_id = 'trace-1'$$,
  'P0001', 'forbidden_column',
  'support cannot change origin'
);

reset role;

select * from finish();

rollback;
