import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Migration source - static contract when live Postgres/containers are unavailable.
const MIGRATION = resolve(
  process.cwd(),
  process.cwd().endsWith('apps/web')
    ? '../../supabase/migrations/20261107120000_mesa_entrada_inbox.sql'
    : 'supabase/migrations/20261107120000_mesa_entrada_inbox.sql',
);
const sql = readFileSync(MIGRATION, 'utf8');

// Structural assertions - events, RPCs, RLS, SLA, quick replies, realtime.
describe('mesa-entrada-inbox migration SQL', () => {
  it('creates conversation_events, conversation_reads, quick_replies', () => {
    expect(sql).toContain('create table if not exists public.conversation_events');
    expect(sql).toContain('create table if not exists public.conversation_reads');
    expect(sql).toContain('create table if not exists public.quick_replies');
    expect(sql).toContain("'QUEUED', 'CLAIMED', 'MOVED', 'DELEGATED'");
    expect(sql).toContain("'AREA_CHANGED'");
  });

  it('adds inquiry coords on conversations without touching citizens GPS', () => {
    expect(sql).toContain('add column if not exists inquiry_latitude');
    expect(sql).toContain('add column if not exists inquiry_longitude');
    expect(sql).toContain('never copied to citizens GPS');
    expect(sql).not.toMatch(/update\s+public\.citizens[\s\S]{0,80}latitude/i);
  });

  it('exposes triage RPCs with CLAIM_CONFLICT and FOR UPDATE', () => {
    for (const name of [
      'claim_conversation',
      'delegate_conversation',
      'accept_conversation_delegation',
      'reject_conversation_delegation',
      'ensure_owner_for_reply',
      'move_conversation',
      'resolve_conversation',
      'reopen_conversation',
      'set_conversation_area',
      'mark_conversation_read',
    ]) {
      expect(sql).toContain(`create or replace function public.${name}`);
    }
    expect(sql).toContain("raise exception 'CLAIM_CONFLICT'");
    expect(sql).toContain('for update');
  });

  it('scopes conversations/messages RLS via current_area_ids with admin bypass', () => {
    expect(sql).toContain('conversations_select_area');
    expect(sql).toContain('messages_select_area');
    expect(sql).toContain("public.current_user_role() = 'admin'");
    expect(sql).toContain('select public.current_area_ids()');
    expect(sql).toContain('delegated_from_user_id = auth.uid()');
  });

  it('defines SLA helpers and FIFO indexes', () => {
    expect(sql).toContain('create or replace function public.business_minutes_between');
    expect(sql).toContain('create or replace function public.compute_conversation_sla_status');
    expect(sql).toContain('conversations_fifo_unowned_idx');
    expect(sql).toContain('add column if not exists business_hours');
  });

  it('seeds municipal quick replies and publishes realtime tables', () => {
    expect(sql).toContain("'/saludo'");
    expect(sql).toContain('alter publication supabase_realtime add table public.conversations');
    expect(sql).toContain('alter publication supabase_realtime add table public.messages');
    expect(sql).toContain('alter publication supabase_realtime add table public.conversation_events');
  });
});
