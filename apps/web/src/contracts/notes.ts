import { z } from 'zod';

export const noteKindSchema = z.enum(['observation', 'status_update', 'system', 'audit', 'bot_summary']);

export const createNoteInputSchema = z
  .object({
    body: z.string().min(1).max(4000),
    conversationId: z.string().uuid().optional(),
    citizenId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
    parentNoteId: z.string().uuid().optional(),
    kind: noteKindSchema.default('observation'),
  })
  .refine((value) => Boolean(value.conversationId || value.citizenId || value.taskId), {
    message: 'NOTE_TARGET_REQUIRED',
  });

export const convertNoteInputSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().max(200).optional(),
  kind: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(4).optional(),
  audience: z.enum(['self', 'area', 'user', 'external']).optional(),
  areaId: z.string().uuid().optional(),
});

export type NoteItem = {
  id: string;
  body: string;
  kind: string;
  authorUserId: string | null;
  conversationId: string | null;
  citizenId: string | null;
  taskId: string | null;
  parentNoteId: string | null;
  sealedAt: string | null;
  createdAt: string;
};
