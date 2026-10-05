-- Hardening after adversarial review (design D11): grants, guards, constraints, storage isolation, purge schedule
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): org A (admin, operator), org B (operator), outsider auth user without profile
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Org A', 'org-a'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Org B', 'org-b');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'a.admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'a.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b1', 'b.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000ff', 'outsider@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Admin A', 'admin', true),
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A', 'operator', true),
  ('00000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-000000000001', 'Operador B', 'operator', true);

insert into storage.objects (bucket_id, name) values
  ('avatars', 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a1/admin.png'),
  ('avatars', 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a2/me.png'),
  ('avatars', 'bbbbbbbb-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000b1/b.png');

-- ---------------------------------------------------------------------------
-- Least-privilege grants (spec org-tenancy: Least-privilege table grants)
-- ---------------------------------------------------------------------------
select table_privs_are('public', 'organizations', 'authenticated', array['SELECT', 'UPDATE'],
  'authenticated holds only SELECT/UPDATE on organizations');
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT', 'UPDATE'],
  'authenticated holds only SELECT/UPDATE on profiles');
select table_privs_are('public', 'error_logs', 'authenticated', array['SELECT', 'UPDATE'],
  'authenticated holds only SELECT/UPDATE on error_logs');
select ok(
  not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute')
  and not has_function_privilege('authenticated', 'public.profiles_guard_privileged_columns()', 'execute')
  and not has_function_privilege('authenticated', 'public.error_logs_guard_update()', 'execute'),
  'authenticated cannot execute trigger functions directly'
);
select ok(
  not has_function_privilege('anon', 'public.set_updated_at()', 'execute')
  and not has_function_privilege('anon', 'public.profiles_guard_privileged_columns()', 'execute')
  and not has_function_privilege('anon', 'public.error_logs_guard_update()', 'execute'),
  'anon cannot execute trigger functions directly'
);
select has_index('public', 'error_logs', 'error_logs_client_reports_idx', 'error_logs has the per-user client-report index');

-- ---------------------------------------------------------------------------
-- Operator: truncate, immutable columns, constraints (spec org-tenancy: Profile self-service limits)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$truncate public.error_logs$$, '42501', null, 'operator cannot truncate error_logs');
select throws_ok(
  $$update public.profiles set created_at = now() - interval '1 year' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'P0001', 'forbidden_column',
  'operator cannot change own created_at'
);
select throws_ok(
  $$update public.profiles set avatar_path = 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a1/admin.png' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  '23514', null,
  'operator cannot point avatar_path at another user'
);
select throws_ok(
  $$update public.profiles set avatar_path = 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a2/../../x.png' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  '23514', null,
  'avatar_path cannot contain parent segments'
);
select throws_ok(
  $$update public.profiles set full_name = '    ' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  '23514', null,
  'full_name of only spaces is rejected'
);
select lives_ok(
  $$update public.profiles set avatar_path = 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a2/new.webp' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'operator can set avatar_path inside own folder'
);

-- ---------------------------------------------------------------------------
-- Storage isolation (spec operator-profile: Deleting / Listing other avatars)
-- The Storage API enables SQL deletes with this setting; RLS still decides which rows match.
-- ---------------------------------------------------------------------------
select set_config('storage.allow_delete_query', 'true', true);

select results_eq(
  $$select name from storage.objects where bucket_id = 'avatars' order by name$$,
  $$values ('aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a1/admin.png'::text),
           ('aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a2/me.png'::text)$$,
  'operator lists only avatars of own organization'
);
select results_eq(
  $$with d as (delete from storage.objects where bucket_id = 'avatars' and name like '%/00000000-0000-4000-8000-0000000000a1/%' returning 1) select count(*)::int from d$$,
  $$values (0)$$,
  'operator deleting another user avatar of the same org affects zero rows'
);
select results_eq(
  $$with d as (delete from storage.objects where bucket_id = 'avatars' and name like 'bbbbbbbb-%' returning 1) select count(*)::int from d$$,
  $$values (0)$$,
  'operator deleting an avatar of another org affects zero rows'
);
select results_eq(
  $$with d as (delete from storage.objects where bucket_id = 'avatars' and name like '%/00000000-0000-4000-8000-0000000000a2/me.png' returning 1) select count(*)::int from d$$,
  $$values (1)$$,
  'operator can delete own avatar'
);

reset role;

-- ---------------------------------------------------------------------------
-- Admin cannot re-key a profile (spec org-tenancy: Admin tries to re-key a profile)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$update public.profiles set id = '00000000-0000-4000-8000-0000000000ff' where id = '00000000-0000-4000-8000-0000000000a2'$$,
  'P0001', 'forbidden_column',
  'admin cannot change a profile id'
);

reset role;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars' and name like 'bbbbbbbb-%'),
  1,
  'org B avatar still exists after cross-org delete attempt'
);
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-0000000000ff'),
  0,
  'no profile was created for the outsider'
);

-- ---------------------------------------------------------------------------
-- Retention schedule (spec error-tracking: Purge scheduled)
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1 from cron.job
    where jobname = 'purge-error-logs' and schedule = '0 6 * * *' and command like '%public.purge_error_logs()%'
  ),
  'purge-error-logs runs daily at 06:00 UTC'
);

select * from finish();

rollback;
