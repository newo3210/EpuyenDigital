import { z } from 'zod';

export const taskKindSchema = z.enum([
  'inquiry',
  'complaint',
  'procedure',
  'documentation',
  'referral',
  'other',
]);

export const taskAudienceSchema = z.enum(['self', 'area', 'user', 'external']);

export const taskOutcomeSchema = z.enum([
  'resolved',
  'abandoned',
  'referred_outside',
  'citizen_unresponsive',
  'duplicate',
]);

export const cancelReasonSchema = z.enum([
  'citizen_unresponsive',
  'duplicate',
  'not_municipal',
  'resolved_other_channel',
  'wrong_area',
  'other',
]);

export const createTaskInputSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(4000).optional(),
  kind: taskKindSchema.default('other'),
  priority: z.coerce.number().int().min(1).max(4).default(3),
  audience: taskAudienceSchema,
  areaId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  externalContactId: z.string().uuid().optional(),
  dueAt: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? '';
      if (!trimmed) return undefined;
      const asDate = new Date(trimmed);
      if (Number.isNaN(asDate.getTime())) return undefined;
      return asDate.toISOString();
    }),
  notifyCitizenOnClose: z
    .union([z.literal('on'), z.literal('true'), z.literal('1'), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'on' || value === 'true' || value === '1'),
});

export const claimTaskInputSchema = z.object({
  taskId: z.string().uuid(),
});

export const rejectTaskInputSchema = z.object({
  taskId: z.string().uuid(),
  note: z.string().min(1).max(500),
});

export const delegateTaskInputSchema = z.object({
  taskId: z.string().uuid(),
  audience: taskAudienceSchema,
  areaId: z.string().uuid().optional(),
  assignedUserId: z.string().uuid().optional(),
  externalContactId: z.string().uuid().optional(),
  note: z.string().min(1).max(500),
});

export const completeTaskInputSchema = z.object({
  taskId: z.string().uuid(),
  outcome: taskOutcomeSchema,
});

export const cancelTaskInputSchema = z.object({
  taskId: z.string().uuid(),
  reason: cancelReasonSchema,
  reasonText: z.string().max(500).optional(),
});

export const listTasksFilterSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'done', 'cancelled', 'failed']).optional(),
  areaId: z.string().uuid().optional(),
});

export const upsertExternalContactInputSchema = z.object({
  id: z.string().uuid().optional(),
  areaId: z.string().uuid(),
  fullName: z.string().min(1).max(200),
  phone: z.string().regex(/^549\d+$/),
  isActive: z
    .union([z.literal('on'), z.literal('true'), z.literal('1'), z.boolean()])
    .optional()
    .transform((value) => value === undefined || value === true || value === 'on' || value === 'true' || value === '1'),
});

export const exportCaseInputSchema = z.object({
  conversationId: z.string().uuid(),
});

export type TaskListItem = {
  id: string;
  publicRef: string;
  title: string;
  status: string;
  kind: string;
  priority: number;
  areaId: string | null;
  assignedUserId: string | null;
  dueAt: string | null;
  overdue: boolean;
  conversationId: string | null;
  citizenId: string | null;
  awaitingAcceptance: boolean;
};

export type ExternalContact = {
  id: string;
  areaId: string;
  fullName: string;
  phoneNormalized: string;
  isActive: boolean;
};

export type TaskDetail = TaskListItem & {
  body: string | null;
  audience: string;
  externalContactId: string | null;
  notifyCitizenOnClose: boolean;
  history: { id: string; event: string; note: string | null; createdAt: string }[];
};
