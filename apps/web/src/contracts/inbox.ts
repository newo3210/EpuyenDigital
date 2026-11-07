import { z } from 'zod';

// Inbox contracts - queue cards, filters, events, SLA (INB-01..15).

export const queueColumnSchema = z.enum([
  'new',
  'claimed',
  'in_progress',
  'waiting_external',
  'resolved',
]);
export type QueueColumn = z.infer<typeof queueColumnSchema>;

export const slaStatusSchema = z.enum(['ok', 'warning', 'critical']);
export type SlaStatus = z.infer<typeof slaStatusSchema>;

export const conversationEventTypeSchema = z.enum([
  'QUEUED',
  'CLAIMED',
  'MOVED',
  'DELEGATED',
  'ACCEPTED',
  'REJECTED',
  'RESOLVED',
  'REOPENED',
  'BOT_PAUSED',
  'BOT_RESUMED',
  'AREA_CHANGED',
]);
export type ConversationEventType = z.infer<typeof conversationEventTypeSchema>;

export const inboxFiltersSchema = z.object({
  areaId: z.string().uuid().optional(),
  lineId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(),
  awaitingMyAcceptance: z.boolean().optional(),
  needsResponse: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  includeResolved: z.boolean().optional(),
});
export type InboxFilters = z.infer<typeof inboxFiltersSchema>;

export const queueCardSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  lineId: z.string().uuid(),
  phoneNormalized: z.string(),
  areaId: z.string().uuid(),
  areaName: z.string().nullable().optional(),
  ownerUserId: z.string().uuid().nullable(),
  ownerName: z.string().nullable().optional(),
  queueColumn: queueColumnSchema,
  botState: z.enum(['active', 'handoff', 'paused']),
  needsResponse: z.boolean(),
  awaitingAcceptance: z.boolean(),
  pendingAreaId: z.string().uuid().nullable(),
  delegatedFromUserId: z.string().uuid().nullable(),
  enteredQueueAt: z.string(),
  lastMessageAt: z.string().nullable(),
  lastInboundAt: z.string().nullable().optional(),
  lastMessagePreview: z.string().nullable().optional(),
  hasAttachments: z.boolean(),
  citizenId: z.string().uuid().nullable(),
  citizenPushName: z.string().nullable().optional(),
  registrationStatus: z.enum(['unregistered', 'registered']).nullable().optional(),
  inquiryLatitude: z.number().nullable().optional(),
  inquiryLongitude: z.number().nullable().optional(),
  slaStatus: slaStatusSchema,
  unread: z.boolean().optional(),
});
export type QueueCard = z.infer<typeof queueCardSchema>;

export const conversationEventSchema = z.object({
  id: z.string().uuid(),
  eventType: conversationEventTypeSchema,
  actorKind: z.enum(['operator', 'bot', 'system', 'external']),
  actorUserId: z.string().uuid().nullable(),
  actorName: z.string().nullable().optional(),
  fromColumn: z.string().nullable().optional(),
  toColumn: z.string().nullable().optional(),
  fromAreaId: z.string().uuid().nullable().optional(),
  toAreaId: z.string().uuid().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type ConversationEvent = z.infer<typeof conversationEventSchema>;

export const quickReplySchema = z.object({
  id: z.string().uuid(),
  shortcut: z.string(),
  title: z.string(),
  body: z.string(),
  areaId: z.string().uuid().nullable().optional(),
});
export type QuickReply = z.infer<typeof quickReplySchema>;

export const delegatePayloadSchema = z
  .object({
    conversationId: z.string().uuid(),
    targetUserId: z.string().uuid().optional(),
    targetAreaId: z.string().uuid().optional(),
    note: z.string().trim().min(1).max(2000),
  })
  .refine(
    (v) =>
      (Boolean(v.targetUserId) && !v.targetAreaId) ||
      (!v.targetUserId && Boolean(v.targetAreaId)),
    { message: 'TARGET_XOR' },
  );
export type DelegatePayload = z.infer<typeof delegatePayloadSchema>;
