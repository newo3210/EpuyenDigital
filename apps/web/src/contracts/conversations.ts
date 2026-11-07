import { z } from 'zod';
import {
  conversationEventSchema,
  queueColumnSchema,
  slaStatusSchema,
} from '@/contracts/inbox';

// Conversation list/thread contracts - triage queue fields for inbox.

export const conversationListItemSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  lineId: z.string().uuid(),
  phoneNormalized: z.string().regex(/^549\d+$/),
  areaId: z.string().uuid(),
  areaName: z.string().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  queueColumn: queueColumnSchema.optional(),
  botState: z.enum(['active', 'handoff', 'paused']).optional(),
  lastMessageAt: z.string().nullable(),
  needsResponse: z.boolean(),
  awaitingAcceptance: z.boolean().optional(),
  pendingAreaId: z.string().uuid().nullable().optional(),
  delegatedFromUserId: z.string().uuid().nullable().optional(),
  citizenPushName: z.string().nullable().optional(),
  registrationStatus: z.enum(['unregistered', 'registered']).nullable().optional(),
  inquiryLatitude: z.number().nullable().optional(),
  inquiryLongitude: z.number().nullable().optional(),
  hasAttachments: z.boolean().optional(),
  slaStatus: slaStatusSchema.optional(),
  unread: z.boolean().optional(),
});

export type ConversationListItem = z.infer<typeof conversationListItemSchema>;

export const threadMessageSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  kind: z.string(),
  body: z.string().nullable(),
  deliveryStatus: z.string().nullable(),
  createdAt: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export type ThreadMessage = z.infer<typeof threadMessageSchema>;

export const conversationThreadSchema = z.object({
  conversation: conversationListItemSchema.extend({
    citizenId: z.string().uuid().nullable(),
    enteredQueueAt: z.string().optional(),
  }),
  messages: z.array(threadMessageSchema),
  events: z.array(conversationEventSchema).optional(),
});

export type ConversationThread = z.infer<typeof conversationThreadSchema>;
