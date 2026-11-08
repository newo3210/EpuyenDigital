import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd().endsWith('apps/web') ? resolve(process.cwd(), '../..') : process.cwd();
const sql = readFileSync(resolve(root, 'supabase/migrations/20261108200000_chatbot_llm.sql'), 'utf8');

describe('chatbot-llm migration SQL', () => {
  it('creates knowledge and bot_runs tables with vector chunks', () => {
    expect(sql).toContain('create table if not exists public.knowledge_documents');
    expect(sql).toContain('create table if not exists public.knowledge_chunks');
    expect(sql).toContain('create table if not exists public.bot_runs');
    expect(sql).toContain('extensions.vector(1536)');
    expect(sql).toContain('function public.upsert_knowledge_document');
    expect(sql).toContain('function public.insert_bot_run');
    expect(sql).toContain('function public.search_knowledge_chunks');
    expect(sql).toContain('function public.set_org_bot_paused');
  });

  it('revokes authenticated writes on knowledge and bot_runs', () => {
    expect(sql).toContain(
      'revoke insert, update, delete on public.knowledge_documents from public, anon, authenticated',
    );
    expect(sql).toContain(
      'revoke insert, update, delete on public.knowledge_chunks from public, anon, authenticated',
    );
    expect(sql).toContain(
      'revoke insert, update, delete on public.bot_runs from public, anon, authenticated',
    );
    expect(sql).toContain('grant execute on function public.search_knowledge_chunks');
    expect(sql).toContain('to service_role');
  });

  it('adds org bot settings and conversation privacy/handoff markers', () => {
    expect(sql).toContain('add column if not exists bot_paused');
    expect(sql).toContain('add column if not exists privacy_notice_sent_at');
    expect(sql).toContain('add column if not exists handoff_ack_sent_at');
    expect(sql).toContain('add column if not exists bot_awaiting_clarification');
  });

  it('keeps resolve from resuming the bot while org pause is on', () => {
    expect(sql).toContain('create or replace function public.resolve_conversation');
    expect(sql).toContain('coalesce(s.bot_paused, false)');
    expect(sql).toContain("next_bot := 'paused'");
  });
});
