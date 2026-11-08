import { z } from 'zod';

// Conversation list row - identity fields shared by the thread header.
export const conversationListItemSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  lineId: z.string().uuid(),
  phoneNormalized: z.string().regex(/^549\d+$/),
  areaId: z.string().uuid(),
  lastMessageAt: z.string().nullable(),
  needsResponse: z.boolean(),
  citizenPushName: z.string().nullable().optional(),
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
  storagePath: z.string().nullable().optional(),
  mediaHref: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
});

export type ThreadMessage = z.infer<typeof threadMessageSchema>;

export const conversationThreadSchema = z.object({
  conversation: conversationListItemSchema.extend({
    citizenId: z.string().uuid().nullable(),
    queueColumn: z.string().optional(),
    botState: z.string().optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
    ownerName: z.string().nullable().optional(),
    awaitingAcceptance: z.boolean().optional(),
  }),
  citizen: z
    .object({
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      registrationStatus: z.string().nullable(),
    })
    .nullable()
    .optional(),
  messages: z.array(threadMessageSchema),
});

export type ConversationThread = z.infer<typeof conversationThreadSchema>;
