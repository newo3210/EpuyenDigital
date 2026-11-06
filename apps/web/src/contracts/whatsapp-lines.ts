import { z } from 'zod';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.lines.errors;

// Line status - matches whatsapp_lines.status check constraint.
export const lineStatusSchema = z.enum(['connected', 'disconnected', 'error']);
export type LineStatus = z.infer<typeof lineStatusSchema>;

// Shared editable fields - secrets are write-only (never echoed after save).
const lineFieldsObjectSchema = z.object({
  name: z
    .string({ required_error: messages.nameRequired, invalid_type_error: messages.nameRequired })
    .trim()
    .min(1, messages.nameRequired)
    .max(80, messages.nameRequired),
  displayPhone: z
    .string({ required_error: messages.displayPhoneRequired })
    .trim()
    .min(8, messages.displayPhoneRequired)
    .max(32, messages.displayPhoneRequired),
  evolutionBaseUrl: z
    .string({ required_error: messages.baseUrlRequired })
    .trim()
    .url(messages.baseUrlInvalid),
  evolutionInstance: z
    .string({ required_error: messages.instanceRequired })
    .trim()
    .min(1, messages.instanceRequired)
    .max(80, messages.instanceRequired),
  defaultAreaId: z
    .string()
    .uuid(messages.areaInvalid)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  apiKey: z.string().optional(),
  webhookSecret: z.string().optional(),
});

export const lineCreateSchema = lineFieldsObjectSchema.superRefine((value, ctx) => {
  if (!value.apiKey || value.apiKey.trim().length < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.apiKeyRequired, path: ['apiKey'] });
  }
  if (!value.webhookSecret || value.webhookSecret.trim().length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.webhookSecretRequired,
      path: ['webhookSecret'],
    });
  }
});

export const lineUpdateSchema = lineFieldsObjectSchema.extend({
  id: z.string({ required_error: messages.idRequired }).uuid(messages.idRequired),
});

export type LineCreateInput = z.infer<typeof lineCreateSchema>;
export type LineUpdateInput = z.infer<typeof lineUpdateSchema>;

// Line entity - list/detail shape; secrets never included as cleartext.
export const whatsappLineSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1),
  displayPhone: z.string().min(1),
  evolutionBaseUrl: z.string().nullable(),
  evolutionInstance: z.string().min(1),
  defaultAreaId: z.string().uuid().nullable(),
  status: lineStatusSchema,
  lastStatusAt: z.string().nullable(),
  hasApiKey: z.boolean(),
  hasWebhookSecret: z.boolean(),
});

export type WhatsappLine = z.infer<typeof whatsappLineSchema>;
