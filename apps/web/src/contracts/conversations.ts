import { z } from 'zod';

// Conversation list row - minimal inbox channel view (no claim/SLA UI).
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
});

export type ThreadMessage = z.infer<typeof threadMessageSchema>;

export const conversationThreadSchema = z.object({
  conversation: conversationListItemSchema.extend({
    citizenId: z.string().uuid().nullable(),
  }),
  messages: z.array(threadMessageSchema),
});

export type ConversationThread = z.infer<typeof conversationThreadSchema>;
