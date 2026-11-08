import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd().endsWith('apps/web') ? resolve(process.cwd(), '../..') : process.cwd();
const sql = readFileSync(resolve(root, 'supabase/migrations/20261108180000_tareas_notas_trazabilidad.sql'), 'utf8');

describe('tareas-notas migration SQL', () => {
  it('creates task and note tables with definer transitions', () => {
    expect(sql).toContain('create table if not exists public.tasks');
    expect(sql).toContain('create table if not exists public.task_history');
    expect(sql).toContain('create table if not exists public.notes');
    expect(sql).toContain('create table if not exists public.external_contacts');
    expect(sql).toContain('function public.create_task');
    expect(sql).toContain('function public.claim_task');
    expect(sql).toContain('function public.complete_task');
    expect(sql).toContain('function public.cancel_task');
    expect(sql).toContain('function public.abandon_stale_tasks');
    expect(sql).toContain('function public.create_note');
    expect(sql).toContain('function public.seal_audit_note');
    expect(sql).toContain('function public.apply_external_task_command');
    expect(sql).toContain('function public.export_case');
    expect(sql).toContain('CANCEL_REASON_REQUIRED');
  });

  it('revokes authenticated writes and keeps sealed notes immutable', () => {
    expect(sql).toContain('revoke insert, update, delete on public.tasks from public, anon, authenticated');
    expect(sql).toContain('revoke insert, update, delete on public.notes from public, anon, authenticated');
    expect(sql).toContain('notes_guard_sealed');
    expect(sql).toContain("role = 'support'");
  });

  it('extends merge and timeline for tasks and notes', () => {
    expect(sql).toContain('update public.tasks set citizen_id = keep_row.id');
    expect(sql).toContain('update public.notes set citizen_id = keep_row.id');
    expect(sql).toContain("'note'::text");
    expect(sql).toContain("'task'::text");
  });
});
