import type { NoteItem } from '@/contracts/notes';
import { RepositoryError, type DbClient } from './errors';

type NoteFilter = {
  conversationId?: string;
  citizenId?: string;
  taskId?: string;
};

// Notes - org-scoped select. Mutations go through create_note / convert_note_to_task.
export async function listNotes(client: DbClient, filter: NoteFilter): Promise<NoteItem[]> {
  let query = client
    .from('notes')
    .select(
      'id, body, kind, author_user_id, conversation_id, citizen_id, task_id, parent_note_id, sealed_at, created_at',
    )
    .order('created_at', { ascending: true })
    .limit(100);

  if (filter.conversationId) query = query.eq('conversation_id', filter.conversationId);
  if (filter.citizenId) query = query.eq('citizen_id', filter.citizenId);
  if (filter.taskId) query = query.eq('task_id', filter.taskId);

  const { data, error } = await query;
  if (error) throw new RepositoryError('notes.list_failed', error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    kind: row.kind,
    authorUserId: row.author_user_id,
    conversationId: row.conversation_id,
    citizenId: row.citizen_id,
    taskId: row.task_id,
    parentNoteId: row.parent_note_id,
    sealedAt: row.sealed_at,
    createdAt: row.created_at,
  }));
}
