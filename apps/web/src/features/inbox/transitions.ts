import { mapRpcError, type OwnershipError } from './ownership-errors';

export type TransitionClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; details?: string; hint?: string; code?: string } | null }>;
};

export type TransitionOk<T> = { status: 'ok'; data: T };
export type TransitionFail = { status: 'error'; error: OwnershipError };
export type TransitionResult<T> = TransitionOk<T> | TransitionFail;

async function callRpc<T>(
  client: TransitionClient,
  fn: string,
  args: Record<string, unknown>,
  map: (row: Record<string, unknown>) => T,
): Promise<TransitionResult<T>> {
  const { data, error } = await client.rpc(fn, args);
  if (error) return { status: 'error', error: mapRpcError(error) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return { status: 'error', error: { code: 'UNKNOWN', message: 'Empty RPC result' } };
  }
  return { status: 'ok', data: map(row as Record<string, unknown>) };
}

// Feature wrappers - each RPC with CLAIM_CONFLICT mapping (INB-02..08).

export function claimConversation(client: TransitionClient, conversationId: string) {
  return callRpc(client, 'claim_conversation', { p_conversation_id: conversationId }, (row) => ({
    conversationId: String(row.conversation_id),
    ownerUserId: String(row.owner_user_id),
    queueColumn: String(row.queue_column),
    botState: String(row.bot_state),
    eventId: row.event_id == null ? null : String(row.event_id),
  }));
}

export function acceptDelegation(client: TransitionClient, conversationId: string) {
  return callRpc(
    client,
    'accept_conversation_delegation',
    { p_conversation_id: conversationId },
    (row) => ({
      conversationId: String(row.conversation_id),
      ownerUserId: String(row.owner_user_id),
      queueColumn: String(row.queue_column),
      eventId: row.event_id == null ? null : String(row.event_id),
    }),
  );
}

export function rejectDelegation(
  client: TransitionClient,
  conversationId: string,
  note: string,
) {
  return callRpc(
    client,
    'reject_conversation_delegation',
    { p_conversation_id: conversationId, p_note: note },
    (row) => ({
      conversationId: String(row.conversation_id),
      ownerUserId: row.owner_user_id == null ? null : String(row.owner_user_id),
      eventId: row.event_id == null ? null : String(row.event_id),
    }),
  );
}

export function delegateConversation(
  client: TransitionClient,
  params: {
    conversationId: string;
    targetUserId?: string;
    targetAreaId?: string;
    note: string;
  },
) {
  return callRpc(
    client,
    'delegate_conversation',
    {
      p_conversation_id: params.conversationId,
      p_target_user_id: params.targetUserId ?? null,
      p_target_area_id: params.targetAreaId ?? null,
      p_note: params.note,
    },
    (row) => ({
      conversationId: String(row.conversation_id),
      ownerUserId: row.owner_user_id == null ? null : String(row.owner_user_id),
      pendingAreaId: row.pending_area_id == null ? null : String(row.pending_area_id),
      awaitingAcceptance: Boolean(row.awaiting_acceptance),
      eventId: row.event_id == null ? null : String(row.event_id),
    }),
  );
}

export function ensureOwnerForReply(client: TransitionClient, conversationId: string) {
  return callRpc(
    client,
    'ensure_owner_for_reply',
    { p_conversation_id: conversationId },
    (row) => ({
      conversationId: String(row.conversation_id),
      ownerUserId: String(row.owner_user_id),
      action: String(row.action),
      eventId: row.event_id == null ? null : String(row.event_id),
    }),
  );
}

export function moveConversation(
  client: TransitionClient,
  conversationId: string,
  toColumn: 'claimed' | 'in_progress' | 'waiting_external',
) {
  return callRpc(
    client,
    'move_conversation',
    { p_conversation_id: conversationId, p_to_column: toColumn },
    (row) => ({
      conversationId: String(row.conversation_id),
      queueColumn: String(row.queue_column),
      eventId: row.event_id == null ? null : String(row.event_id),
    }),
  );
}

export function resolveConversation(client: TransitionClient, conversationId: string) {
  return callRpc(client, 'resolve_conversation', { p_conversation_id: conversationId }, (row) => ({
    conversationId: String(row.conversation_id),
    queueColumn: String(row.queue_column),
    botState: String(row.bot_state),
    eventId: row.event_id == null ? null : String(row.event_id),
  }));
}

export function reopenConversation(client: TransitionClient, conversationId: string) {
  return callRpc(client, 'reopen_conversation', { p_conversation_id: conversationId }, (row) => ({
    conversationId: String(row.conversation_id),
    queueColumn: String(row.queue_column),
    botState: String(row.bot_state),
    eventId: row.event_id == null ? null : String(row.event_id),
  }));
}

export function setConversationArea(
  client: TransitionClient,
  conversationId: string,
  areaId: string,
) {
  return callRpc(
    client,
    'set_conversation_area',
    { p_conversation_id: conversationId, p_area_id: areaId },
    (row) => ({
      conversationId: String(row.conversation_id),
      areaId: String(row.area_id),
      eventId: row.event_id == null ? null : String(row.event_id),
    }),
  );
}

export async function markConversationRead(
  client: TransitionClient,
  conversationId: string,
  messageId?: string | null,
): Promise<TransitionResult<{ ok: true }>> {
  const { error } = await client.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
    p_message_id: messageId ?? null,
  });
  if (error) return { status: 'error', error: mapRpcError(error) };
  return { status: 'ok', data: { ok: true } };
}
