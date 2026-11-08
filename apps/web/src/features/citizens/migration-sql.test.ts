import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd().endsWith('apps/web') ? resolve(process.cwd(), '../..') : process.cwd();
const sql = readFileSync(resolve(root, 'supabase/migrations/20261108120000_pobladores_ficha.sql'), 'utf8');
const stub = readFileSync(resolve(root, 'apps/web/src/infrastructure/supabase-inbound-store.ts'), 'utf8');
const repository = readFileSync(resolve(root, 'apps/web/src/infrastructure/repositories/citizens.ts'), 'utf8');

describe('pobladores ficha migration SQL', () => {
  it('adds profile columns, the guard, and the four functions', () => {
    expect(sql).toContain('field_sources jsonb');
    expect(sql).toContain('merged_into_id');
    expect(sql).toContain('function public.citizens_guard_manual_fields');
    expect(sql).toContain('function public.update_citizen_profile');
    expect(sql).toContain('function public.register_citizen');
    expect(sql).toContain('function public.search_citizens');
    expect(sql).toContain('function public.merge_citizens');
    expect(sql).toContain('function public.list_citizen_timeline');
    expect(sql).toContain('for update');
    expect(sql).toContain('merge_note');
    expect(sql).toContain('MISSING_FIELDS');
    expect(sql).toContain('NOTE_REQUIRED');
    expect(sql).toContain('ALREADY_REGISTERED');
  });

  it('revokes authenticated writes and limits search to the caller org', () => {
    expect(sql).toContain('revoke insert, update, delete on public.citizens from public, anon, authenticated');
    expect(sql).toContain('grant select on public.citizens to authenticated');
    expect(sql).toContain("c.org_id = public.current_org_id()");
    expect(sql).toContain('c.merged_into_id is null');
    expect(sql).toContain('limit 20');
    expect(sql).toContain("role = 'support'");
  });

  it('keeps a manual column unless the operator function is writing', () => {
    expect(sql).toContain("if sources ->> 'full_name' = 'manual' then new.full_name := old.full_name;");
    expect(sql).toContain("app.citizen_field_write', 'operator'");
  });
});

describe('ficha reads', () => {
  it('does not query notes or tasks', () => {
    expect(repository).not.toContain("from('notes')");
    expect(repository).not.toContain("from('tasks')");
    expect(repository).toContain("rpc('list_citizen_timeline'");
    expect(sql).toContain('from public.messages');
    expect(sql).toContain('from public.animals');
  });
});

describe('channel stub source', () => {
  it('writes the WhatsApp push name and does not assign full_name', () => {
    const start = stub.indexOf('upsertCitizenStub');
    const body = stub.slice(start, start + 1600);
    expect(body).toContain('whatsapp_push_name');
    expect(body).not.toMatch(/full_name\s*[:=]/);
    expect(body).not.toMatch(/\blatitude\s*[:=]/);
  });
});
