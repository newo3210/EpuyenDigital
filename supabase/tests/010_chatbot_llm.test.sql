-- Chatbot LLM: admin knowledge write, support forbidden, bot_runs no client write, expired excluded.
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into public.organizations (id, name, slug) values
  ('eeeeeeee-0000-4000-8000-0000000000aa', 'Org Bot', 'org-bot');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'bot.admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c2', 'bot.support@test.local', 'authenticated', 'authenticated');

insert into public.profiles (id, org_id, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000c1', 'eeeeeeee-0000-4000-8000-0000000000aa', 'Admin B', 'admin', true),
  ('00000000-0000-4000-8000-0000000000c2', 'eeeeeeee-0000-4000-8000-0000000000aa', 'Support B', 'support', true);

insert into public.org_settings (org_id) values ('eeeeeeee-0000-4000-8000-0000000000aa');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select * from public.upsert_knowledge_document(
    null, 'Horarios', 'text', 'Rentas de 8 a 14', null, null, true, null
  )$$,
  'admin can upsert knowledge'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);

select throws_ok(
  $$select * from public.upsert_knowledge_document(
    null, 'No', 'text', 'x', null, null, true, null
  )$$,
  'P0001',
  'FORBIDDEN',
  'support cannot upsert knowledge'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.bot_runs (org_id, conversation_id, decision)
    values ('eeeeeeee-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-0000000000e1', 'answered')$$,
  '42501',
  'authenticated cannot insert bot_runs'
);

reset role;

insert into public.knowledge_documents (
  id, org_id, title, source_kind, body_text, is_active, index_status, valid_until
) values (
  '00000000-0000-4000-8000-0000000000d9',
  'eeeeeeee-0000-4000-8000-0000000000aa',
  'Vencido',
  'text',
  'viejo',
  true,
  'ready',
  now() - interval '1 day'
);

insert into public.knowledge_chunks (org_id, document_id, chunk_index, content)
values (
  'eeeeeeee-0000-4000-8000-0000000000aa',
  '00000000-0000-4000-8000-0000000000d9',
  0,
  'contenido vencido rentas'
);

select is(
  (select count(*)::integer from public.search_knowledge_chunks(
    'eeeeeeee-0000-4000-8000-0000000000aa', 'rentas', 5
  )),
  0,
  'expired documents are excluded from retrieval'
);

select lives_ok(
  $$select * from public.set_org_bot_paused(true)$$,
  'admin can pause bot'
);

select is(
  (select bot_paused from public.org_settings where org_id = 'eeeeeeee-0000-4000-8000-0000000000aa'),
  true,
  'bot_paused persisted'
);

select * from finish();
rollback;
