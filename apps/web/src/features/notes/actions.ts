'use server';

import { revalidatePath } from 'next/cache';
import { convertNoteInputSchema, createNoteInputSchema } from '@/contracts/notes';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { mapNoteError } from './map-error';

const MUTATE = ['admin', 'area_lead', 'operator'] as const;

export type NoteActionState = {
  status?: 'ok' | 'error';
  message?: string;
  publicRef?: string;
};

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function refreshTargets(input: {
  conversationId?: string;
  citizenId?: string;
  taskId?: string;
}) {
  revalidatePath('/tasks');
  if (input.conversationId) revalidatePath(`/inbox/${input.conversationId}`);
  if (input.citizenId) revalidatePath(`/citizens/${input.citizenId}`);
  if (input.taskId) revalidatePath(`/tasks/${input.taskId}`);
}

export async function createNoteAction(
  _previous: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  await requirePageRole(MUTATE);
  const parsed = createNoteInputSchema.safeParse({
    body: readText(formData, 'body'),
    conversationId: readText(formData, 'conversationId') || undefined,
    citizenId: readText(formData, 'citizenId') || undefined,
    taskId: readText(formData, 'taskId') || undefined,
    parentNoteId: readText(formData, 'parentNoteId') || undefined,
    kind: readText(formData, 'kind') || 'observation',
  });
  if (!parsed.success) return { status: 'error', message: esAR.notes.errors.invalidField };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('create_note', {
    p_body: parsed.data.body,
    p_conversation_id: parsed.data.conversationId ?? null,
    p_citizen_id: parsed.data.citizenId ?? null,
    p_task_id: parsed.data.taskId ?? null,
    p_parent_note_id: parsed.data.parentNoteId ?? null,
    p_kind: parsed.data.kind,
  });
  if (error) return { status: 'error', message: mapNoteError(error) };
  refreshTargets(parsed.data);
  return { status: 'ok', message: esAR.notes.saved };
}

export async function convertNoteToTaskAction(
  _previous: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  await requirePageRole(MUTATE);
  const parsed = convertNoteInputSchema.safeParse({
    noteId: readText(formData, 'noteId'),
    title: readText(formData, 'title') || undefined,
    kind: readText(formData, 'kind') || undefined,
    priority: readText(formData, 'priority') || undefined,
    audience: readText(formData, 'audience') || undefined,
    areaId: readText(formData, 'areaId') || undefined,
  });
  if (!parsed.success) return { status: 'error', message: esAR.notes.errors.invalidField };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('convert_note_to_task', {
    p_note_id: parsed.data.noteId,
    p_title: parsed.data.title ?? null,
    p_kind: parsed.data.kind ?? null,
    p_priority: parsed.data.priority ?? null,
    p_audience: parsed.data.audience ?? null,
    p_area_id: parsed.data.areaId ?? null,
  });
  if (error) return { status: 'error', message: mapNoteError(error) };
  revalidatePath('/tasks');
  return {
    status: 'ok',
    message: esAR.notes.converted.replace('{ref}', data?.[0]?.result_public_ref ?? ''),
    publicRef: data?.[0]?.result_public_ref,
  };
}
