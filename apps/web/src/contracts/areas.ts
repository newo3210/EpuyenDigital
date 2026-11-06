import { z } from 'zod';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.areas.errors;

// Color contract - #RRGGBB matching the areas.color check constraint.
export const areaColorSchema = z
  .string({ required_error: messages.invalidColor, invalid_type_error: messages.invalidColor })
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, messages.invalidColor);

// Optional positive SLA minutes - empty string / null becomes undefined.
const optionalPositiveMinutes = z
  .union([z.number(), z.string(), z.undefined(), z.null()])
  .transform((value, ctx) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(number) || number <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.invalidSla });
      return z.NEVER;
    }
    return number;
  });

// SLA order refine - critical must be >= warning when both are set.
function refineSlaOrder<T extends { slaWarningMinutes?: number; slaCriticalMinutes?: number }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (
    value.slaWarningMinutes !== undefined &&
    value.slaCriticalMinutes !== undefined &&
    value.slaCriticalMinutes < value.slaWarningMinutes
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: messages.slaOrder,
      path: ['slaCriticalMinutes'],
    });
  }
}

// Shared area fields - name uniqueness (case-insensitive trim) is enforced in the database.
const areaFieldsObjectSchema = z.object({
  name: z
    .string({ required_error: messages.nameRequired, invalid_type_error: messages.nameRequired })
    .trim()
    .min(1, messages.nameRequired)
    .max(80, messages.nameRequired),
  description: z
    .string()
    .trim()
    .max(500, messages.descriptionTooLong)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  color: areaColorSchema,
  isActive: z.boolean(),
  isDefault: z.boolean(),
  slaWarningMinutes: optionalPositiveMinutes,
  slaCriticalMinutes: optionalPositiveMinutes,
});

// Create payload - admin creates an area for the caller's organization.
export const areaCreateSchema = areaFieldsObjectSchema.superRefine(refineSlaOrder);

// Update payload - identified area plus the same editable fields.
export const areaUpdateSchema = areaFieldsObjectSchema
  .extend({
    id: z.string({ required_error: messages.idRequired }).uuid(messages.idRequired),
  })
  .superRefine(refineSlaOrder);

export type AreaCreateInput = z.infer<typeof areaCreateSchema>;
export type AreaUpdateInput = z.infer<typeof areaUpdateSchema>;

// Area entity - list/detail shape returned to presentation.
export const areaSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  color: areaColorSchema,
  isActive: z.boolean(),
  isDefault: z.boolean(),
  slaWarningMinutes: z.number().int().positive().nullable(),
  slaCriticalMinutes: z.number().int().positive().nullable(),
});

export type Area = z.infer<typeof areaSchema>;
