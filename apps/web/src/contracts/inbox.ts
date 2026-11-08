import { z } from 'zod';

// Queue filters - query string values for the inbox list.
export const inboxFiltersSchema = z.object({
  areaId: z.string().uuid().optional(),
  lineId: z.string().uuid().optional(),
  owner: z.string().trim().min(1).max(40).optional(),
  awaitingMine: z.boolean().optional(),
  unanswered: z.boolean().optional(),
  withAttachments: z.boolean().optional(),
});

export type InboxFilters = z.infer<typeof inboxFiltersSchema>;

// Delegate input - exactly one target and a note.
export const delegateInputSchema = z
  .object({
    conversationId: z.string().uuid(),
    targetUserId: z.string().uuid().optional(),
    targetAreaId: z.string().uuid().optional(),
    note: z.string().trim().min(1, 'La nota es obligatoria.').max(1000),
  })
  .refine((value) => Number(Boolean(value.targetUserId)) + Number(Boolean(value.targetAreaId)) === 1, {
    message: 'Elegí una persona o un área.',
    path: ['targetUserId'],
  });

// Column move - resolved is a separate action.
export const moveColumnSchema = z.object({
  conversationId: z.string().uuid(),
  column: z.enum(['claimed', 'in_progress', 'waiting_external']),
});

// Area change - active area in the same organization, checked again in SQL.
export const setAreaSchema = z.object({
  conversationId: z.string().uuid(),
  areaId: z.string().uuid(),
});

// Reject note - empty notes never reach the database.
export const rejectNoteSchema = z.object({
  conversationId: z.string().uuid(),
  note: z.string().trim().min(1, 'Escribí el motivo del rechazo.').max(1000),
});

const hm = z.string().regex(/^\d{2}:\d{2}$/);
const dayWindows = z.array(z.tuple([hm, hm]));

// Weekly hours - one or more ranges per day, empty array means closed.
export const businessHoursSchema = z.object({
  mon: dayWindows,
  tue: dayWindows,
  wed: dayWindows,
  thu: dayWindows,
  fri: dayWindows,
  sat: dayWindows,
  sun: dayWindows,
});

export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;

// Quick reply fields - area null means every area.
export const quickReplySchema = z.object({
  shortcut: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
  areaId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type QuickReplyInput = z.infer<typeof quickReplySchema>;

// Queue card - denormalized row returned by list_inbox_queue.
export const queueCardSchema = z.object({
  id: z.string().uuid(),
  phoneNormalized: z.string(),
  areaId: z.string().uuid(),
  areaName: z.string(),
  lineId: z.string().uuid(),
  ownerUserId: z.string().uuid().nullable(),
  ownerName: z.string().nullable(),
  queueColumn: z.string(),
  botState: z.string(),
  needsResponse: z.boolean(),
  awaitingAcceptance: z.boolean(),
  hasAttachments: z.boolean(),
  lastMessageAt: z.string().nullable(),
  lastMessagePreview: z.string().nullable(),
  slaLevel: z.enum(['ok', 'warning', 'critical', 'hidden']),
  registrationStatus: z.string().nullable(),
  citizenPushName: z.string().nullable(),
  unread: z.boolean(),
});

export type QueueCard = z.infer<typeof queueCardSchema>;

// Thread event - append-only timeline row.
export type InboxEvent = {
  id: string;
  eventType: string;
  actorKind: string;
  note: string | null;
  createdAt: string;
  fromColumn: string | null;
  toColumn: string | null;
};

// Quick reply shown in the composer.
export type QuickReply = {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  areaId: string | null;
};

// Person or area option for delegation and routing.
export type InboxOption = {
  id: string;
  label: string;
};
