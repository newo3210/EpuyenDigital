import { z } from 'zod';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.settings.areas.errors;

// Area name - trimmed 1-80 chars for create/update forms.
const areaNameSchema = z
  .string({ required_error: messages.nameRequired, invalid_type_error: messages.nameRequired })
  .trim()
  .min(1, messages.nameRequired)
  .max(80, messages.nameLength);

// Optional description - empty string becomes null.
const areaDescriptionSchema = z
  .string()
  .trim()
  .max(500, messages.descriptionLength)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

// Optional color - hex #RRGGBB; empty/null allowed.
const areaColorSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional()
  .refine((value) => value === null || value === undefined || /^#[0-9A-Fa-f]{6}$/.test(value), {
    message: messages.colorInvalid,
  });

// Create area form - name required; description/color/active optional.
export const createAreaSchema = z.object({
  name: areaNameSchema,
  description: areaDescriptionSchema,
  color: areaColorSchema,
  isActive: z.boolean().optional().default(true),
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;

// Update area form - id plus the same mutable fields as create.
export const updateAreaSchema = createAreaSchema.extend({
  id: z.string().uuid(),
});

export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;

// Set-default - target area id only (RPC clears the previous default).
export const setDefaultAreaSchema = z.object({
  areaId: z.string().uuid(),
});

export type SetDefaultAreaInput = z.infer<typeof setDefaultAreaSchema>;

// Membership assign - operator + area + optional lead flag.
export const assignMembershipSchema = z.object({
  areaId: z.string().uuid(),
  userId: z.string().uuid(),
  isLead: z.boolean().optional().default(false),
});

export type AssignMembershipInput = z.infer<typeof assignMembershipSchema>;

// Membership remove - composite key.
export const removeMembershipSchema = z.object({
  areaId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type RemoveMembershipInput = z.infer<typeof removeMembershipSchema>;
