import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Migration source - static contract when live Postgres is unavailable.
const MIGRATION = resolve(
  process.cwd(),
  process.cwd().endsWith('apps/web')
    ? '../../supabase/migrations/20261107120000_mesa_entrada_inbox.sql'
    : 'supabase/migrations/20261107120000_mesa_entrada_inbox.sql',
);
const sql = readFileSync(MIGRATION, 'utf8');

describe('mesa-entrada-inbox migration SQL', () => {
  it('adds events, reads, quick replies, and preview columns', () => {
    expect(sql).toContain('create table if not exists public.conversation_events');
    expect(sql).toContain('create table if not exists public.conversation_reads');
    expect(sql).toContain('create table if not exists public.quick_replies');
    expect(sql).toContain('last_message_preview');
    expect(sql).toContain('has_attachments');
    expect(sql).toContain('business_hours jsonb');
  });

  it('defines ownership functions and the unowned-first queue order', () => {
    expect(sql).toContain('function public.claim_conversation');
    expect(sql).toContain('function public.ensure_owner_for_reply');
    expect(sql).toContain('function public.delegate_conversation');
    expect(sql).toContain('function public.reject_conversation_delegation');
    expect(sql).toContain('function public.reopen_conversation');
    expect(sql).toContain('function public.list_inbox_queue');
    expect(sql).toContain('(c.owner_user_id is null) desc');
    expect(sql).toContain('CLAIM_CONFLICT');
    expect(sql).toContain('NOTE_REQUIRED');
  });

  it('tightens reads to area visibility and revokes client writes on events', () => {
    expect(sql).toContain('conversations_select_visible');
    expect(sql).toContain('messages_select_visible');
    expect(sql).toContain('revoke insert, update, delete on public.conversation_events from authenticated, anon');
    expect(sql).toContain('supabase_realtime add table public.conversations');
  });

  it('keeps reopen on the service role', () => {
    expect(sql).toContain("jwt_role is distinct from 'service_role'");
    expect(sql).toContain('grant execute on function public.reopen_conversation(uuid, timestamptz, uuid) to service_role');
  });

  it('revokes internal definer helpers from authenticated callers', () => {
    expect(sql).toContain(
      'revoke all on function public.inbox_lock_conversation(uuid) from public, anon, authenticated',
    );
    expect(sql).toContain(
      'revoke all on function public.inbox_event(public.conversations, text, uuid, text, text, uuid, uuid, text, jsonb) from public, anon, authenticated',
    );
    expect(sql).not.toContain('c.needs_response and not exists');
    expect(sql).toContain("regexp_replace(coalesce(p_note, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g')");
    expect(sql).toContain(
      'grant execute on function public.conversation_visible_to_caller(public.conversations) to authenticated',
    );
  });
});
