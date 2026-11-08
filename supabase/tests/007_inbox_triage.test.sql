-- Inbox triage: claim conflict, area visibility, reject note, reopen once, append-only events.
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into public.organizations (id, name, slug) values
  ('aaaaaaaa-0000-4000-8000-0000000000aa', 'Org A', 'org-a-inbox'),
  ('bbbbbbbb-0000-4000-8000-0000000000bb', 'Org B', 'org-b-inbox');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'inbox.a1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'inbox.a2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'inbox.lead@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b1', 'inbox.b1@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'Operador Mesa', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'Operador Mesa 2', 'operator', true),
  ('00000000-0000-4000-8000-0000000000a3', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'Lead Otra', 'area_lead', true),
  ('00000000-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-0000000000bb', 'Operador B', 'operator', true);

insert into public.areas (id, org_id, name, is_default, sla_warning_minutes, sla_critical_minutes) values
  ('00000000-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'Mesa', true, 30, 120),
  ('00000000-0000-4000-8000-0000000000d2', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'Otra', false, null, null),
  ('00000000-0000-4000-8000-0000000000d3', 'bbbbbbbb-0000-4000-8000-0000000000bb', 'Mesa B', true, null, null);

insert into public.area_members (area_id, user_id, is_lead) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', false),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a2', false),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a3', true),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000b1', false);

insert into public.whatsapp_lines (id, org_id, name, display_phone, evolution_instance, status, default_area_id) values
  ('00000000-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'Linea A', '+5491100000001', 'inbox-a', 'disconnected', '00000000-0000-4000-8000-0000000000d1');

insert into public.conversations (
  id, org_id, line_id, phone_normalized, area_id, queue_column, entered_queue_at, needs_response
) values (
  '00000000-0000-4000-8000-0000000000f1',
  'aaaaaaaa-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000e1',
  '5491100000001',
  '00000000-0000-4000-8000-0000000000d1',
  'new',
  now() - interval '2 hours',
  true
);

select is(
  public.add_business_minutes(
    '2026-11-06 13:00:00-03'::timestamptz,
    120,
    public.default_business_hours(),
    '{}'::date[],
    'America/Argentina/Buenos_Aires'
  ),
  '2026-11-09 09:00:00-03'::timestamptz,
  'Friday 13:00 plus 120 business minutes lands Monday 09:00'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.conversations where id = '00000000-0000-4000-8000-0000000000f1'),
  0,
  'operator outside the area cannot see the conversation'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.claim_conversation('00000000-0000-4000-8000-0000000000f1')$$,
  'P0001',
  'FORBIDDEN',
  'cross-org claim is forbidden'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select result_owner_user_id from public.claim_conversation('00000000-0000-4000-8000-0000000000f1')),
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'first claim wins'
);
select is(
  (select bot_state from public.conversations where id = '00000000-0000-4000-8000-0000000000f1'),
  'paused',
  'claim pauses the bot'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.claim_conversation('00000000-0000-4000-8000-0000000000f1')$$,
  'P0001',
  'CLAIM_CONFLICT',
  'second claim conflicts'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select result_hint from public.delegate_conversation(
    '00000000-0000-4000-8000-0000000000f1',
    null,
    '00000000-0000-4000-8000-0000000000d2',
    'pasar a otra'
  )),
  'ok',
  'owner delegates to an area'
);
select is(
  (select count(*)::int from public.conversations where id = '00000000-0000-4000-8000-0000000000f1'),
  1,
  'delegator still sees the conversation'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.reject_conversation_delegation('00000000-0000-4000-8000-0000000000f1', '   ')$$,
  'P0001',
  'NOTE_REQUIRED',
  'reject without a note fails'
);
select is(
  (select result_owner_user_id from public.reject_conversation_delegation(
    '00000000-0000-4000-8000-0000000000f1',
    'no corresponde'
  )),
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  'reject returns the conversation to the delegator'
);
select throws_ok(
  $$update public.conversation_events set note = 'hack'$$,
  '42501',
  null,
  'authenticated cannot update events'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select result_hint from public.resolve_conversation('00000000-0000-4000-8000-0000000000f1');
reset role;

insert into public.messages (
  id, org_id, line_id, conversation_id, external_id, direction, phone_normalized, kind, body
) values (
  '00000000-0000-4000-8000-0000000000c1',
  'aaaaaaaa-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000e1',
  '00000000-0000-4000-8000-0000000000f1',
  'ext-reopen-1',
  'inbound',
  '5491100000001',
  'text',
  'volvi'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select is(
  (select result_hint from public.reopen_conversation(
    '00000000-0000-4000-8000-0000000000f1',
    now(),
    '00000000-0000-4000-8000-0000000000c1'
  )),
  'ok',
  'citizen reply reopens a resolved conversation'
);
select result_hint from public.reopen_conversation(
  '00000000-0000-4000-8000-0000000000f1',
  now(),
  '00000000-0000-4000-8000-0000000000c1'
);
select is(
  (
    select count(*)::int from public.conversation_events
    where conversation_id = '00000000-0000-4000-8000-0000000000f1'
      and event_type = 'REOPENED'
  ),
  1,
  'a second reopen for the same message does not add another event'
);

select * from finish();
rollback;
