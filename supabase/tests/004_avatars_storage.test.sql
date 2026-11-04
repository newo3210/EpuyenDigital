-- Avatars storage: public bucket, writes only inside {org_id}/{user_id}/ (spec operator-profile)
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): org A with two operators and one inactive operator
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Org A', 'org-a');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a2', 'a.op@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a4', 'a.op2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'a.inactive@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a4', 'aaaaaaaa-0000-4000-8000-000000000001', 'Operador A2', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-000000000001', 'Inactivo A', 'operator', false);

insert into storage.objects (bucket_id, name) values
  ('avatars', 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a4/existing.png');

-- ---------------------------------------------------------------------------
-- Bucket configuration
-- ---------------------------------------------------------------------------
select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'$$,
  $$values (true, 2097152::bigint, array['image/jpeg', 'image/png', 'image/webp']::text[])$$,
  'avatars bucket is public, 2 MB limit, JPEG/PNG/WebP only'
);

-- ---------------------------------------------------------------------------
-- Active operator writes
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a2/me.png')$$,
  'operator can write inside own {org_id}/{user_id}/ folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a4/evil.png')$$,
  '42501', null,
  'operator cannot write inside another user folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a2/evil.png')$$,
  '42501', null,
  'operator cannot write inside another organization folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'evil.png')$$,
  '42501', null,
  'operator cannot write at the bucket root'
);
select results_eq(
  $$with u as (update storage.objects set name = name || '.bak' where bucket_id = 'avatars' and name like '%/00000000-0000-4000-8000-0000000000a4/%' returning 1) select count(*)::int from u$$,
  $$values (0)$$,
  'operator updating another user avatar affects zero rows'
);

reset role;

-- ---------------------------------------------------------------------------
-- Inactive operator
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('avatars', 'aaaaaaaa-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000000a3/me.png')$$,
  '42501', null,
  'inactive operator cannot write even in own folder'
);

reset role;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars' and name like 'aaaaaaaa-0000-4000-8000-000000000001/%'),
  2,
  'only the fixture and the legitimate upload exist in the bucket'
);

select * from finish();

rollback;
