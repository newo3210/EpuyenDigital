import type { ExternalContact, TaskDetail, TaskListItem } from '@/contracts/tasks';
import { RepositoryError, type DbClient } from './errors';

// List - board rows already filtered and ordered by the database.
export async function listTasks(
  client: DbClient,
  filters: { status?: string; areaId?: string } = {},
): Promise<TaskListItem[]> {
  const { data, error } = await client.rpc('list_tasks', {
    p_status: filters.status ?? null,
    p_area_id: filters.areaId ?? null,
  });
  if (error) throw new RepositoryError('tasks.list_failed', error.message);
  return (data ?? []).map((row) => ({
    id: row.result_id,
    publicRef: row.result_public_ref,
    title: row.result_title,
    status: row.result_status,
    kind: row.result_kind,
    priority: row.result_priority,
    areaId: row.result_area_id,
    assignedUserId: row.result_assigned_user_id,
    dueAt: row.result_due_at,
    overdue: row.result_overdue,
    conversationId: row.result_conversation_id,
    citizenId: row.result_citizen_id,
    awaitingAcceptance: row.result_awaiting_acceptance,
  }));
}

// Detail - one visible task plus append-only history.
export async function getTaskDetail(client: DbClient, taskId: string): Promise<TaskDetail | null> {
  const { data, error } = await client
    .from('tasks')
    .select(
      'id, public_ref, title, body, status, kind, priority, audience, area_id, assigned_user_id, external_contact_id, due_at, conversation_id, citizen_id, awaiting_acceptance, notify_citizen_on_close',
    )
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw new RepositoryError('tasks.read_failed', error.message);
  if (!data) return null;

  const history = await client
    .from('task_history')
    .select('id, event, note, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (history.error) throw new RepositoryError('tasks.history_failed', history.error.message);

  const dueAt = (data as { due_at?: string | null }).due_at ?? null;
  const status = String((data as { status: string }).status);
  const overdue = Boolean(dueAt && new Date(dueAt).getTime() < Date.now() && ['pending', 'in_progress'].includes(status));

  return {
    id: data.id,
    publicRef: (data as { public_ref: string }).public_ref,
    title: data.title,
    body: (data as { body: string | null }).body,
    status,
    kind: String((data as { kind: string }).kind),
    priority: Number((data as { priority: number }).priority),
    audience: String((data as { audience: string }).audience),
    areaId: (data as { area_id: string | null }).area_id,
    assignedUserId: (data as { assigned_user_id: string | null }).assigned_user_id,
    externalContactId: (data as { external_contact_id: string | null }).external_contact_id,
    dueAt,
    overdue,
    conversationId: (data as { conversation_id: string | null }).conversation_id,
    citizenId: (data as { citizen_id: string | null }).citizen_id,
    awaitingAcceptance: Boolean((data as { awaiting_acceptance: boolean }).awaiting_acceptance),
    notifyCitizenOnClose: Boolean((data as { notify_citizen_on_close: boolean }).notify_citizen_on_close),
    history: (history.data ?? []).map((row) => ({
      id: row.id,
      event: row.event,
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}

export async function listExternalContacts(client: DbClient): Promise<ExternalContact[]> {
  const { data, error } = await client
    .from('external_contacts')
    .select('id, area_id, full_name, phone_normalized, is_active')
    .order('full_name');
  if (error) throw new RepositoryError('tasks.external_list_failed', error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    areaId: row.area_id,
    fullName: row.full_name,
    phoneNormalized: row.phone_normalized,
    isActive: row.is_active,
  }));
}

export async function exportCase(client: DbClient, conversationId: string): Promise<unknown> {
  const { data, error } = await client.rpc('export_case', { p_conversation_id: conversationId });
  if (error) throw new RepositoryError('tasks.export_failed', error.message);
  return data;
}
