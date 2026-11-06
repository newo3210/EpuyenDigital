import {
  conversationListItemSchema,
  conversationThreadSchema,
  type ConversationListItem,
  type ConversationThread,
  type ThreadMessage,
} from '@/contracts/conversations';
import { RepositoryError, type DbClient } from './errors';

// List conversations - org-scoped under RLS; newest activity first.
export async function listConversations(client: DbClient): Promise<ConversationListItem[]> {
  const { data, error } = await client
    .from('conversations')
    .select('id, org_id, line_id, phone_normalized, area_id, last_message_at, needs_response, citizen_id')
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new RepositoryError('conversations.read_failed', error.message);

  const rows = data ?? [];
  const citizenIds = rows
    .map((row) => row.citizen_id as string | null)
    .filter((id): id is string => Boolean(id));
  const pushNames = await loadPushNames(client, citizenIds);

  return rows.map((row) => {
    const citizenId = row.citizen_id as string | null;
    const parsed = conversationListItemSchema.safeParse({
      id: row.id,
      orgId: row.org_id,
      lineId: row.line_id,
      phoneNormalized: row.phone_normalized,
      areaId: row.area_id,
      lastMessageAt: row.last_message_at,
      needsResponse: row.needs_response,
      citizenPushName: citizenId ? (pushNames.get(citizenId) ?? null) : null,
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
    .select('id, org_id, line_id, phone_normalized, area_id, last_message_at, needs_response, citizen_id')
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
  const pushNames = citizenId ? await loadPushNames(client, [citizenId]) : new Map<string, string | null>();

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

  const parsed = conversationThreadSchema.safeParse({
    conversation: {
      id: conv.id,
      orgId: conv.org_id,
      lineId: conv.line_id,
      phoneNormalized: conv.phone_normalized,
      areaId: conv.area_id,
      lastMessageAt: conv.last_message_at,
      needsResponse: conv.needs_response,
      citizenPushName: citizenId ? (pushNames.get(citizenId) ?? null) : null,
      citizenId,
    },
    messages: threadMessages,
  });
  if (!parsed.success) throw new RepositoryError('conversations.invalid_row', parsed.error.message);
  return parsed.data;
}

async function loadPushNames(
  client: DbClient,
  citizenIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (citizenIds.length === 0) return map;
  const { data, error } = await client
    .from('citizens')
    .select('id, whatsapp_push_name')
    .in('id', citizenIds);
  if (error) throw new RepositoryError('citizens.read_failed', error.message);
  for (const row of data ?? []) {
    map.set(row.id as string, (row.whatsapp_push_name as string | null) ?? null);
  }
  return map;
}
