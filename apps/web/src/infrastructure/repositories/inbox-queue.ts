import {
  conversationEventSchema,
  queueCardSchema,
  quickReplySchema,
  type ConversationEvent,
  type InboxFilters,
  type QueueCard,
  type QuickReply,
} from '@/contracts/inbox';
import { computeSlaStatus, type BusinessHours } from '@/features/inbox/sla';
import { filterQueueCards, sortQueueCards } from '@/features/inbox/queue-sort';
import { RepositoryError, type DbClient } from './errors';

type AreaSla = {
  id: string;
  name: string;
  sla_warning_minutes: number | null;
  sla_critical_minutes: number | null;
};

// listInboxQueue - area-RLS filtered rows, FIFO unowned-first, filters + SLA.
export async function listInboxQueue(
  client: DbClient,
  params: {
    filters?: InboxFilters;
    currentUserId: string;
    businessHours?: BusinessHours | null;
    holidays?: string[] | null;
  },
): Promise<QueueCard[]> {
  const filters = params.filters ?? {};
  let query = client
    .from('conversations')
    .select(
      'id, org_id, line_id, phone_normalized, area_id, owner_user_id, queue_column, bot_state, needs_response, awaiting_acceptance, pending_area_id, delegated_from_user_id, entered_queue_at, last_message_at, last_inbound_at, last_message_preview, has_attachments, citizen_id, inquiry_latitude, inquiry_longitude',
    );

  if (!filters.includeResolved) {
    query = query.neq('queue_column', 'resolved');
  }
  if (filters.areaId) query = query.eq('area_id', filters.areaId);
  if (filters.lineId) query = query.eq('line_id', filters.lineId);
  if (filters.ownerUserId) query = query.eq('owner_user_id', filters.ownerUserId);
  if (filters.needsResponse) query = query.eq('needs_response', true);
  if (filters.hasAttachments) query = query.eq('has_attachments', true);

  const { data, error } = await query.limit(500);
  if (error) throw new RepositoryError('inbox.queue_read_failed', error.message);

  const rows = data ?? [];
  const areaIds = [...new Set(rows.map((r) => r.area_id as string))];
  const citizenIds = rows
    .map((r) => r.citizen_id as string | null)
    .filter((id): id is string => Boolean(id));
  const ownerIds = rows
    .map((r) => r.owner_user_id as string | null)
    .filter((id): id is string => Boolean(id));

  const [areas, citizens, owners, reads] = await Promise.all([
    loadAreas(client, areaIds),
    loadCitizens(client, citizenIds),
    loadProfiles(client, ownerIds),
    loadReads(client, params.currentUserId, rows.map((r) => r.id as string)),
  ]);

  const cards: QueueCard[] = rows.map((row) => {
    const area = areas.get(row.area_id as string);
    const citizenId = row.citizen_id as string | null;
    const citizen = citizenId ? citizens.get(citizenId) : undefined;
    const ownerId = row.owner_user_id as string | null;
    const lastReadAt = reads.get(row.id as string);
    const lastInbound = (row.last_inbound_at as string | null) ?? null;
    const unread = Boolean(
      lastInbound && (!lastReadAt || new Date(lastInbound) > new Date(lastReadAt)),
    );

    const slaStatus = computeSlaStatus({
      enteredQueueAt: row.entered_queue_at as string,
      area: {
        warningMinutes: area?.sla_warning_minutes ?? null,
        criticalMinutes: area?.sla_critical_minutes ?? null,
      },
      businessHours: params.businessHours,
      holidays: params.holidays,
      resolved: (row.queue_column as string) === 'resolved',
    });

    const parsed = queueCardSchema.safeParse({
      id: row.id,
      orgId: row.org_id,
      lineId: row.line_id,
      phoneNormalized: row.phone_normalized,
      areaId: row.area_id,
      areaName: area?.name ?? null,
      ownerUserId: ownerId,
      ownerName: ownerId ? (owners.get(ownerId) ?? null) : null,
      queueColumn: row.queue_column,
      botState: row.bot_state,
      needsResponse: row.needs_response,
      awaitingAcceptance: row.awaiting_acceptance,
      pendingAreaId: row.pending_area_id,
      delegatedFromUserId: row.delegated_from_user_id,
      enteredQueueAt: row.entered_queue_at,
      lastMessageAt: row.last_message_at,
      lastInboundAt: lastInbound,
      lastMessagePreview: row.last_message_preview ?? null,
      hasAttachments: row.has_attachments ?? false,
      citizenId,
      citizenPushName: citizen?.whatsapp_push_name ?? null,
      registrationStatus: citizen?.registration_status ?? null,
      inquiryLatitude: row.inquiry_latitude == null ? null : Number(row.inquiry_latitude),
      inquiryLongitude: row.inquiry_longitude == null ? null : Number(row.inquiry_longitude),
      slaStatus,
      unread,
    });
    if (!parsed.success) {
      throw new RepositoryError('inbox.invalid_card', parsed.error.message);
    }
    return parsed.data;
  });

  const filtered = filterQueueCards(cards, {
    awaitingMyAcceptance: filters.awaitingMyAcceptance,
    currentUserId: params.currentUserId,
  });
  return sortQueueCards(filtered);
}

export async function listConversationEvents(
  client: DbClient,
  conversationId: string,
): Promise<ConversationEvent[]> {
  const { data, error } = await client
    .from('conversation_events')
    .select(
      'id, event_type, actor_kind, actor_user_id, from_column, to_column, from_area_id, to_area_id, note, created_at',
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new RepositoryError('inbox.events_read_failed', error.message);

  const actorIds = (data ?? [])
    .map((r) => r.actor_user_id as string | null)
    .filter((id): id is string => Boolean(id));
  const names = await loadProfiles(client, actorIds);

  return (data ?? []).map((row) => {
    const actorId = row.actor_user_id as string | null;
    const parsed = conversationEventSchema.safeParse({
      id: row.id,
      eventType: row.event_type,
      actorKind: row.actor_kind,
      actorUserId: actorId,
      actorName: actorId ? (names.get(actorId) ?? null) : null,
      fromColumn: row.from_column ?? null,
      toColumn: row.to_column ?? null,
      fromAreaId: row.from_area_id ?? null,
      toAreaId: row.to_area_id ?? null,
      note: row.note ?? null,
      createdAt: row.created_at,
    });
    if (!parsed.success) {
      throw new RepositoryError('inbox.invalid_event', parsed.error.message);
    }
    return parsed.data;
  });
}

export async function listQuickReplies(
  client: DbClient,
  areaId?: string | null,
): Promise<QuickReply[]> {
  let query = client
    .from('quick_replies')
    .select('id, shortcut, title, body, area_id')
    .eq('is_active', true)
    .order('shortcut', { ascending: true });

  const { data, error } = await query;
  if (error) throw new RepositoryError('inbox.quick_replies_failed', error.message);

  return (data ?? [])
    .filter((row) => {
      const replyArea = row.area_id as string | null;
      if (replyArea == null) return true;
      if (!areaId) return true;
      return replyArea === areaId;
    })
    .map((row) => {
      const parsed = quickReplySchema.safeParse({
        id: row.id,
        shortcut: row.shortcut,
        title: row.title,
        body: row.body,
        areaId: row.area_id ?? null,
      });
      if (!parsed.success) {
        throw new RepositoryError('inbox.invalid_quick_reply', parsed.error.message);
      }
      return parsed.data;
    });
}

export async function loadOrgSlaSettings(
  client: DbClient,
  orgId: string,
): Promise<{ businessHours: BusinessHours; holidays: string[] }> {
  const { data, error } = await client
    .from('org_settings')
    .select('business_hours, holidays')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw new RepositoryError('inbox.org_settings_failed', error.message);
  return {
    businessHours: (data?.business_hours as BusinessHours | null) ?? {},
    holidays: ((data?.holidays as string[] | null) ?? []).map(String),
  };
}

async function loadAreas(client: DbClient, ids: string[]): Promise<Map<string, AreaSla>> {
  const map = new Map<string, AreaSla>();
  if (ids.length === 0) return map;
  const { data, error } = await client
    .from('areas')
    .select('id, name, sla_warning_minutes, sla_critical_minutes')
    .in('id', ids);
  if (error) throw new RepositoryError('inbox.areas_failed', error.message);
  for (const row of data ?? []) {
    map.set(row.id as string, row as AreaSla);
  }
  return map;
}

async function loadCitizens(
  client: DbClient,
  ids: string[],
): Promise<Map<string, { whatsapp_push_name: string | null; registration_status: string }>> {
  const map = new Map<string, { whatsapp_push_name: string | null; registration_status: string }>();
  if (ids.length === 0) return map;
  const { data, error } = await client
    .from('citizens')
    .select('id, whatsapp_push_name, registration_status')
    .in('id', ids);
  if (error) throw new RepositoryError('inbox.citizens_failed', error.message);
  for (const row of data ?? []) {
    map.set(row.id as string, {
      whatsapp_push_name: (row.whatsapp_push_name as string | null) ?? null,
      registration_status: (row.registration_status as string) ?? 'unregistered',
    });
  }
  return map;
}

async function loadProfiles(client: DbClient, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await client.from('profiles').select('id, full_name').in('id', ids);
  if (error) throw new RepositoryError('inbox.profiles_failed', error.message);
  for (const row of data ?? []) {
    map.set(row.id as string, (row.full_name as string) ?? '');
  }
  return map;
}

async function loadReads(
  client: DbClient,
  userId: string,
  conversationIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (conversationIds.length === 0) return map;
  const { data, error } = await client
    .from('conversation_reads')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)
    .in('conversation_id', conversationIds);
  if (error) throw new RepositoryError('inbox.reads_failed', error.message);
  for (const row of data ?? []) {
    map.set(row.conversation_id as string, row.last_read_at as string);
  }
  return map;
}
