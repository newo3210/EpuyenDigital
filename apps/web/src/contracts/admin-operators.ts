import { z } from 'zod';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.settings.operators.errors;

// Roles creatable from the operators UI (support stays seed/manual for v1).
export const OPERATOR_ADMIN_ROLES = ['admin', 'area_lead', 'operator'] as const;
export const operatorAdminRoleSchema = z.enum(OPERATOR_ADMIN_ROLES, {
  errorMap: () => ({ message: messages.roleInvalid }),
});

export type OperatorAdminRole = z.infer<typeof operatorAdminRoleSchema>;

// Temporary password - minimum length aligned with seed admin password policy.
export const TEMP_PASSWORD_MIN = 10;

// Create operator form - email, display name, role, temp password, optional area ids.
export const createOperatorSchema = z.object({
  email: z
    .string({ required_error: messages.emailInvalid, invalid_type_error: messages.emailInvalid })
    .trim()
    .email(messages.emailInvalid)
    .transform((value) => value.toLowerCase()),
  fullName: z
    .string({ required_error: messages.nameRequired, invalid_type_error: messages.nameRequired })
    .trim()
    .min(2, messages.nameLength)
    .max(80, messages.nameLength),
  role: operatorAdminRoleSchema,
  temporaryPassword: z
    .string({ required_error: messages.passwordRequired, invalid_type_error: messages.passwordRequired })
    .min(TEMP_PASSWORD_MIN, messages.passwordLength),
  areaIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreateOperatorInput = z.infer<typeof createOperatorSchema>;

// Update operator - role and/or active flag (at least one field required by the use case).
export const updateOperatorSchema = z.object({
  userId: z.string().uuid(),
  role: operatorAdminRoleSchema.optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().trim().min(2).max(80).optional(),
});

export type UpdateOperatorInput = z.infer<typeof updateOperatorSchema>;
