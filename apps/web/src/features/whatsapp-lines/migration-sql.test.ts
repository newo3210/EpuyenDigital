import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Migration source - static contract when live Postgres/containers are unavailable.
const MIGRATION = resolve(
  process.cwd(),
  process.cwd().endsWith('apps/web')
    ? '../../supabase/migrations/20261107010000_whatsapp_channel_core.sql'
    : 'supabase/migrations/20261107010000_whatsapp_channel_core.sql',
);
const sql = readFileSync(MIGRATION, 'utf8');

// Structural assertions - conversations uniqueness, secrets deny, line default area, seed Mesa.
describe('whatsapp-channel-core migration SQL', () => {
  it('extends whatsapp_lines with default_area_id, last_status_at and line_status check', () => {
    expect(sql).toContain('add column if not exists default_area_id');
    expect(sql).toContain('add column if not exists last_status_at');
    expect(sql).toContain("check (status in ('connected', 'disconnected', 'error'))");
  });

  it('adds webhook_secret_ciphertext and revokes authenticated access to secrets', () => {
    expect(sql).toContain('add column if not exists webhook_secret_ciphertext');
    expect(sql).toContain('revoke all on table public.whatsapp_line_secrets from anon, authenticated');
  });

  it('creates conversations with unique (org_id, line_id, phone_normalized)', () => {
    expect(sql).toContain('create table if not exists public.conversations');
    expect(sql).toContain('unique (org_id, line_id, phone_normalized)');
    expect(sql).toContain("queue_column text not null default 'new'");
    expect(sql).toContain("bot_state text not null default 'active'");
  });

  it('adds conversation_id on messages and keeps delivery_status vocabulary', () => {
    expect(sql).toContain('add column if not exists conversation_id');
    expect(sql).toContain("'pending', 'sent', 'delivered', 'read', 'failed', 'blocked', 'simulated'");
  });

  it('backfills conversations and seeds Inspectoría default_area_id to Mesa de Entrada', () => {
    expect(sql).toContain('insert into public.conversations');
    expect(sql).toContain("a.name = 'Mesa de Entrada'");
    expect(sql).toContain("wl.evolution_instance = 'inspectoria'");
  });

  it('enables org-scoped SELECT RLS; drops authenticated message/conversation writes', () => {
    expect(sql).toContain('alter table public.conversations enable row level security');
    expect(sql).toContain('conversations_select_org');
    expect(sql).toContain('messages_select_org');
    expect(sql).toContain('drop policy if exists messages_insert_org');
    expect(sql).toContain('drop policy if exists messages_update_org');
    expect(sql).toContain('drop policy if exists conversations_insert_org');
    expect(sql).toContain('drop policy if exists conversations_update_org');
    expect(sql).not.toMatch(
      /create policy messages_insert_org[\s\S]*for insert to authenticated/,
    );
    expect(sql).toContain("public.current_user_role() = 'admin'");
    expect(sql).toContain('whatsapp_lines_admin_insert');
  });

  it('creates private whatsapp-media storage bucket', () => {
    expect(sql).toContain("'whatsapp-media'");
    expect(sql).toContain('false');
  });
});
