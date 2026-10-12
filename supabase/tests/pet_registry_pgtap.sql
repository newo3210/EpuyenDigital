-- pgTAP - pet registry uniqueness, municipal ID, species check
begin;
select plan(8);

-- Seed org for tests if missing
insert into public.organizations (id, name, slug)
values ('11111111-1111-4111-8111-111111111111', 'Test Org', 'test-org-pgtap')
on conflict (slug) do nothing;

insert into public.citizens (id, org_id, full_name, document_id, neighborhood, latitude, longitude, privacy_consent_at)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Test Citizen',
  '30111222',
  'Centro',
  -42.1,
  -71.3,
  now()
)
on conflict do nothing;

insert into public.citizen_phones (org_id, citizen_id, phone_normalized)
values (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '5499999999999'
)
on conflict do nothing;

select throws_ok(
  $$insert into public.citizen_phones (org_id, citizen_id, phone_normalized)
    values (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '5499999999999'
    )$$,
  '23505',
  null,
  'citizen phone uniqueness per org'
);

insert into public.neighborhood_codes (org_id, neighborhood_normalized, code)
values ('11111111-1111-4111-8111-111111111111', 'centro', 'CENT')
on conflict do nothing;

select municipal_id
from public.complete_animal_registration(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'Luna', 'dog', 'female', 'mestiza', 'medium', 'adulto',
  'yes', 'up_to_date', null, -42.1, -71.3, 'Centro'
);

select ok(
  exists (
    select 1 from public.animals
    where org_id = '11111111-1111-4111-8111-111111111111'
      and municipal_id like 'CENT-%-00001'
  ),
  'municipal id uses CENT prefix and seq 00001'
);

select municipal_id
from public.complete_animal_registration(
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'Michi', 'cat', 'male', 'naranjoso', 'small', 'cachorro',
  'no', 'pending', null, -42.1, -71.3, 'Paraje Desconocido'
);

select ok(
  exists (
    select 1 from public.animals
    where org_id = '11111111-1111-4111-8111-111111111111'
      and municipal_id like 'EPU-%-00002'
  ),
  'unknown barrio falls back to EPU and increments counter'
);

select throws_ok(
  $$insert into public.animals (
      org_id, citizen_id, name, species, sex, breed_color, size, age_stage,
      sterilized, rabies_status, municipal_id, status
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'Caballo', 'horse', 'male', 'alazan', 'large', 'adulto',
      'no', 'pending', 'EPU-2099-99999', 'active'
    )$$,
  '23514',
  null,
  'species check rejects horse'
);

select ok(
  (
    select last_seq from public.animal_id_counters
    where org_id = '11111111-1111-4111-8111-111111111111'
    order by year desc limit 1
  ) = 2,
  'counter incremented twice'
);

select ok(
  (
    select count(distinct municipal_id) = count(*)
    from public.animals
    where org_id = '11111111-1111-4111-8111-111111111111'
  ),
  'municipal ids unique within org'
);

select col_has_default('public', 'registration_sessions', 'expires_at', 'session expiry default present');

select finish();
rollback;
