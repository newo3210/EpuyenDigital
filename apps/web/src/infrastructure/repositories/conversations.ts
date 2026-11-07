import {
  conversationListItemSchema,
  conversationThreadSchema,
  type ConversationListItem,
  type ConversationThread,
  type ThreadMessage,
} from '@/contracts/conversations';
import { listConversationEvents } from './inbox-queue';
import { RepositoryError, type DbClient } from './errors';

// List conversations - thin compatibility wrapper (prefer listInboxQueue for triage).
export async function listConversations(client: DbClient): Promise<ConversationListItem[]> {
  const { data, error } = await client
    .from('conversations')
    .select(
      'id, org_id, line_id, phone_normalized, area_id, owner_user_id, queue_column, bot_state, last_message_at, needs_response, awaiting_acceptance, pending_area_id, citizen_id, inquiry_latitude, inquiry_longitude, has_attachments',
    )
    .neq('queue_column', 'resolved')
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new RepositoryError('conversations.read_failed', error.message);

  const rows = data ?? [];
  const citizenIds = rows
    .map((row) => row.citizen_id as string | null)
    .filter((id): id is string => Boolean(id));
  const pushNames = await loadCitizens(client, citizenIds);

  return rows.map((row) => {
    const citizenId = row.citizen_id as string | null;
    const citizen = citizenId ? pushNames.get(citizenId) : undefined;
    const parsed = conversationListItemSchema.safeParse({
      id: row.id,
      orgId: row.org_id,
      lineId: row.line_id,
      phoneNormalized: row.phone_normalized,
      areaId: row.area_id,
      ownerUserId: row.owner_user_id ?? null,
      queueColumn: row.queue_column,
      botState: row.bot_state,
      lastMessageAt: row.last_message_at,
      needsResponse: row.needs_response,
      awaitingAcceptance: row.awaiting_acceptance ?? false,
      pendingAreaId: row.pending_area_id ?? null,
      citizenPushName: citizen?.pushName ?? null,
      registrationStatus: citizen?.registrationStatus ?? null,
      inquiryLatitude: row.inquiry_latitude == null ? null : Number(row.inquiry_latitude),
      inquiryLongitude: row.inquiry_longitude == null ? null : Number(row.inquiry_longitude),
      hasAttachments: row.has_attachments ?? false,
    });
    if (!parsed.success) throw new RepositoryError('conversations.invalid_row', parsed.error.message);
    return parsed.data;
  });
}

export async function getConversationThread(
  client: DbClient,
  conversationId: string,
): Promise<ConversationThread | null> {
  const { data: conv, error: convError } = await client
    .from('conversations')
    .select(
      'id, org_id, line_id, phone_normalized, area_id, owner_user_id, queue_column, bot_state, last_message_at, needs_response, awaiting_acceptance, pending_area_id, delegated_from_user_id, entered_queue_at, citizen_id, inquiry_latitude, inquiry_longitude, has_attachments',
    )
    .eq('id', conversationId)
    .maybeSingle();
  if (convError) throw new RepositoryError('conversations.read_failed', convError.message);
  if (!conv) return null;

  const { data: messages, error: msgError } = await client
    .from('messages')
    .select('id, direction, kind, body, delivery_status, created_at, latitude, longitude')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (msgError) throw new RepositoryError('messages.read_failed', msgError.message);

  const citizenId = conv.citizen_id as string | null;
  const citizens = citizenId ? await loadCitizens(client, [citizenId]) : new Map();
  const events = await listConversationEvents(client, conversationId);

  const threadMessages: ThreadMessage[] = (messages ?? []).map((m) => ({
    id: m.id as string,
    direction: m.direction as 'inbound' | 'outbound',
    kind: m.kind as string,
    body: (m.body as string | null) ?? null,
    deliveryStatus: (m.delivery_status as string | null) ?? null,
    createdAt: m.created_at as string,
    latitude: m.latitude == null ? null : Number(m.latitude),
    longitude: m.longitude == null ? null : Number(m.longitude),
  }));

  const citizen = citizenId ? citizens.get(citizenId) : undefined;
  const parsed = conversationThreadSchema.safeParse({
    conversation: {
      id: conv.id,
      orgId: conv.org_id,
      lineId: conv.line_id,
      phoneNormalized: conv.phone_normalized,
      areaId: conv.area_id,
      ownerUserId: conv.owner_user_id ?? null,
      queueColumn: conv.queue_column,
      botState: conv.bot_state,
      lastMessageAt: conv.last_message_at,
      needsResponse: conv.needs_response,
      awaitingAcceptance: conv.awaiting_acceptance ?? false,
      pendingAreaId: conv.pending_area_id ?? null,
      delegatedFromUserId: conv.delegated_from_user_id ?? null,
      citizenPushName: citizen?.pushName ?? null,
      registrationStatus: citizen?.registrationStatus ?? null,
      inquiryLatitude: conv.inquiry_latitude == null ? null : Number(conv.inquiry_latitude),
      inquiryLongitude: conv.inquiry_longitude == null ? null : Number(conv.inquiry_longitude),
      hasAttachments: conv.has_attachments ?? false,
      citizenId,
      enteredQueueAt: conv.entered_queue_at as string,
    },
    messages: threadMessages,
    events,
  });
  if (!parsed.success) throw new RepositoryError('conversations.invalid_row', parsed.error.message);
  return parsed.data;
}

async function loadCitizens(
  client: DbClient,
  citizenIds: string[],
): Promise<Map<string, { pushName: string | null; registrationStatus: 'unregistered' | 'registered' }>> {
  const map = new Map<
    string,
    { pushName: string | null; registrationStatus: 'unregistered' | 'registered' }
  >();
  if (citizenIds.length === 0) return map;
  const { data, error } = await client
    .from('citizens')
    .select('id, whatsapp_push_name, registration_status')
    .in('id', citizenIds);
  if (error) throw new RepositoryError('citizens.read_failed', error.message);
  for (const row of data ?? []) {
    map.set(row.id as string, {
      pushName: (row.whatsapp_push_name as string | null) ?? null,
      registrationStatus:
        (row.registration_status as 'unregistered' | 'registered' | null) ?? 'unregistered',
    });
  }
  return map;
}
