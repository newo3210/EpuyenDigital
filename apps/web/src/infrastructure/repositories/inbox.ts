import {
  queueCardSchema,
  type InboxEvent,
  type InboxFilters,
  type InboxOption,
  type QueueCard,
  type QuickReply,
} from '@/contracts/inbox';
import { RepositoryError, type DbClient } from './errors';

// List queue - SQL already applies visibility, filters, and unowned-first order.
export async function listInboxQueue(client: DbClient, filters: InboxFilters): Promise<QueueCard[]> {
  const { data, error } = await client.rpc('list_inbox_queue', {
    p_area_id: filters.areaId ?? undefined,
    p_line_id: filters.lineId ?? undefined,
    p_owner: filters.owner ?? undefined,
    p_awaiting_mine: filters.awaitingMine ?? false,
    p_unanswered: filters.unanswered ?? false,
    p_with_attachments: filters.withAttachments ?? false,
  });
  if (error) throw new RepositoryError('inbox.queue_failed', error.message);

  return (data ?? []).map((row) => {
    const parsed = queueCardSchema.safeParse({
      id: row.id,
      phoneNormalized: row.phone_normalized,
      areaId: row.area_id,
      areaName: row.area_name,
      lineId: row.line_id,
      ownerUserId: row.owner_user_id,
      ownerName: row.owner_name,
      queueColumn: row.queue_column,
      botState: row.bot_state,
      needsResponse: row.needs_response,
      awaitingAcceptance: row.awaiting_acceptance,
      hasAttachments: row.has_attachments,
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      slaLevel: row.sla_level,
      registrationStatus: row.registration_status,
      citizenPushName: row.citizen_push_name,
      unread: row.unread,
    });
    if (!parsed.success) throw new RepositoryError('inbox.invalid_row', parsed.error.message);
    return parsed.data;
  });
}

// Attention count - unread inbound plus delegations waiting on this operator.
export async function countInboxAttention(client: DbClient): Promise<number> {
  const { data, error } = await client.rpc('inbox_attention_count');
  if (error) throw new RepositoryError('inbox.badge_failed', error.message);
  return data ?? 0;
}

// Timeline - events the operator is allowed to read.
export async function listConversationEvents(client: DbClient, conversationId: string): Promise<InboxEvent[]> {
  const { data, error } = await client
    .from('conversation_events')
    .select('id, event_type, actor_kind, note, created_at, from_column, to_column')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new RepositoryError('inbox.events_failed', error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    actorKind: row.actor_kind,
    note: row.note,
    createdAt: row.created_at,
    fromColumn: row.from_column,
    toColumn: row.to_column,
  }));
}

// Active replies - org-wide plus the conversation area. Insert does not send.
export async function listQuickReplies(client: DbClient, areaId: string): Promise<QuickReply[]> {
  const { data, error } = await client
    .from('quick_replies')
    .select('id, shortcut, title, body, area_id, is_active')
    .eq('is_active', true)
    .order('title', { ascending: true });
  if (error) throw new RepositoryError('inbox.replies_failed', error.message);
  return (data ?? [])
    .filter((row) => row.area_id == null || row.area_id === areaId)
    .map((row) => ({
      id: row.id,
      shortcut: row.shortcut,
      title: row.title,
      body: row.body,
      areaId: row.area_id,
    }));
}

// Active operators - delegation targets in the same organization.
export async function listOperatorOptions(client: DbClient): Promise<InboxOption[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, is_active, role')
    .eq('is_active', true)
    .order('full_name', { ascending: true });
  if (error) throw new RepositoryError('inbox.operators_failed', error.message);
  return (data ?? [])
    .filter((row) => row.role !== 'support')
    .map((row) => ({ id: row.id, label: row.full_name }));
}

// Mark read - only the caller's marker moves.
export async function markConversationRead(client: DbClient, conversationId: string): Promise<void> {
  const { error } = await client.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  if (error) throw new RepositoryError('inbox.read_failed', error.message);
}
