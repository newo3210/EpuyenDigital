'use server';

import { revalidatePath } from 'next/cache';
import {
  cancelTaskInputSchema,
  claimTaskInputSchema,
  completeTaskInputSchema,
  createTaskInputSchema,
  delegateTaskInputSchema,
  exportCaseInputSchema,
  rejectTaskInputSchema,
  upsertExternalContactInputSchema,
} from '@/contracts/tasks';
import { requirePageRole } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { createServerSupabase } from '@/infrastructure/supabase/server';
import { mapTaskError } from './map-error';

const READ = ['admin', 'area_lead', 'operator', 'support'] as const;
const MUTATE = ['admin', 'area_lead', 'operator'] as const;
const ADMIN = ['admin'] as const;

export type TaskActionState = {
  status?: 'ok' | 'error';
  message?: string;
  publicRef?: string;
  payload?: unknown;
};

function readText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function refresh(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

async function run(
  paths: string[],
  call: () => PromiseLike<{ error: { message: string; hint?: string | null; details?: string | null } | null }>,
  okMessage = esAR.tasks.saved,
): Promise<TaskActionState> {
  const { error } = await call();
  if (error) return { status: 'error', message: mapTaskError(error) };
  refresh(paths);
  return { status: 'ok', message: okMessage };
}

// Create - from a conversation thread. External audience enqueues notify inside SQL.
// Citizen notify on resolved close is enqueued inside complete_task (definer).
export async function createTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const parsed = createTaskInputSchema.safeParse({
    conversationId: readText(formData, 'conversationId'),
    title: readText(formData, 'title'),
    body: readText(formData, 'body'),
    kind: readText(formData, 'kind') || 'other',
    priority: readText(formData, 'priority') || '3',
    audience: readText(formData, 'audience'),
    areaId: readText(formData, 'areaId') || undefined,
    assignedUserId: readText(formData, 'assignedUserId') || undefined,
    externalContactId: readText(formData, 'externalContactId') || undefined,
    dueAt: readText(formData, 'dueAt') || undefined,
    notifyCitizenOnClose: readText(formData, 'notifyCitizenOnClose'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.invalidField };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('create_task', {
    p_conversation_id: parsed.data.conversationId,
    p_title: parsed.data.title,
    p_body: parsed.data.body ?? null,
    p_kind: parsed.data.kind,
    p_priority: parsed.data.priority,
    p_audience: parsed.data.audience,
    p_area_id: parsed.data.areaId ?? null,
    p_assigned_user_id: parsed.data.assignedUserId ?? null,
    p_external_contact_id: parsed.data.externalContactId ?? null,
    p_due_at: parsed.data.dueAt ?? null,
    p_notify_citizen_on_close: parsed.data.notifyCitizenOnClose ?? false,
    p_source_note_id: null,
  });
  if (error) return { status: 'error', message: mapTaskError(error) };
  const row = data?.[0];
  refresh(['/tasks', `/inbox/${parsed.data.conversationId}`]);
  return {
    status: 'ok',
    message: esAR.tasks.created.replace('{ref}', row?.result_public_ref ?? ''),
    publicRef: row?.result_public_ref,
  };
}

export async function claimTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const parsed = claimTaskInputSchema.safeParse({ taskId: readText(formData, 'taskId') });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.failed };
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${parsed.data.taskId}`], () =>
    supabase.rpc('claim_task', { p_task_id: parsed.data.taskId }),
  );
}

export async function acceptTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const taskId = readText(formData, 'taskId') ?? '';
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${taskId}`], () => supabase.rpc('accept_task', { p_task_id: taskId }));
}

export async function rejectTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const parsed = rejectTaskInputSchema.safeParse({
    taskId: readText(formData, 'taskId'),
    note: readText(formData, 'note'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.noteRequired };
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${parsed.data.taskId}`], () =>
    supabase.rpc('reject_task', { p_task_id: parsed.data.taskId, p_note: parsed.data.note }),
  );
}

export async function startTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const taskId = readText(formData, 'taskId') ?? '';
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${taskId}`], () => supabase.rpc('start_task', { p_task_id: taskId }));
}

export async function delegateTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const parsed = delegateTaskInputSchema.safeParse({
    taskId: readText(formData, 'taskId'),
    audience: readText(formData, 'audience'),
    areaId: readText(formData, 'areaId') || undefined,
    assignedUserId: readText(formData, 'assignedUserId') || undefined,
    externalContactId: readText(formData, 'externalContactId') || undefined,
    note: readText(formData, 'note'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.noteRequired };
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${parsed.data.taskId}`], () =>
    supabase.rpc('delegate_task', {
      p_task_id: parsed.data.taskId,
      p_audience: parsed.data.audience,
      p_area_id: parsed.data.areaId ?? null,
      p_assigned_user_id: parsed.data.assignedUserId ?? null,
      p_external_contact_id: parsed.data.externalContactId ?? null,
      p_note: parsed.data.note,
    }),
  );
}

export async function completeTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const parsed = completeTaskInputSchema.safeParse({
    taskId: readText(formData, 'taskId'),
    outcome: readText(formData, 'outcome'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.invalidOutcome };
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${parsed.data.taskId}`], () =>
    supabase.rpc('complete_task', { p_task_id: parsed.data.taskId, p_outcome: parsed.data.outcome }),
  );
}

export async function cancelTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const parsed = cancelTaskInputSchema.safeParse({
    taskId: readText(formData, 'taskId'),
    reason: readText(formData, 'reason'),
    reasonText: readText(formData, 'reasonText'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.cancelReasonRequired };
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${parsed.data.taskId}`], () =>
    supabase.rpc('cancel_task', {
      p_task_id: parsed.data.taskId,
      p_reason: parsed.data.reason,
      p_reason_text: parsed.data.reasonText ?? null,
    }),
  );
}

export async function reopenTaskAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(MUTATE);
  const taskId = readText(formData, 'taskId') ?? '';
  const supabase = await createServerSupabase();
  return run(['/tasks', `/tasks/${taskId}`], () => supabase.rpc('reopen_task', { p_task_id: taskId }));
}

export async function upsertExternalContactAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(ADMIN);
  const parsed = upsertExternalContactInputSchema.safeParse({
    id: readText(formData, 'id') || undefined,
    areaId: readText(formData, 'areaId'),
    fullName: readText(formData, 'fullName'),
    phone: readText(formData, 'phone'),
    isActive: readText(formData, 'isActive') ?? 'on',
  });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.invalidField };
  const supabase = await createServerSupabase();
  return run(['/settings/external-contacts'], () =>
    supabase.rpc('upsert_external_contact', {
      p_id: parsed.data.id ?? null,
      p_area_id: parsed.data.areaId,
      p_full_name: parsed.data.fullName,
      p_phone: parsed.data.phone,
      p_is_active: parsed.data.isActive,
    }),
  );
}

export async function exportCaseAction(
  _previous: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  await requirePageRole(READ);
  const parsed = exportCaseInputSchema.safeParse({
    conversationId: readText(formData, 'conversationId'),
  });
  if (!parsed.success) return { status: 'error', message: esAR.tasks.errors.failed };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('export_case', {
    p_conversation_id: parsed.data.conversationId,
  });
  if (error) return { status: 'error', message: mapTaskError(error) };
  return { status: 'ok', message: esAR.tasks.exportReady, payload: data };
}
