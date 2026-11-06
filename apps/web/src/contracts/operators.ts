import { z } from 'zod';
import { fullNameSchema, roleSchema } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.operators.errors;

// Membership row - area assignment with optional lead flag.
export const membershipInputSchema = z.object({
  areaId: z.string({ required_error: messages.areaRequired }).uuid(messages.areaRequired),
  isLead: z.boolean(),
});

export type MembershipInput = z.infer<typeof membershipInputSchema>;

// Temporary password - shown once in the admin UI after create (no invite email).
export const temporaryPasswordSchema = z
  .string({ required_error: messages.passwordRequired, invalid_type_error: messages.passwordRequired })
  .min(10, messages.passwordLength)
  .max(72, messages.passwordLength);

// Create operator - Auth user + profile + memberships; email change after create is rejected in v1.
export const operatorCreateSchema = z.object({
  email: z
    .string({ required_error: messages.invalidEmail, invalid_type_error: messages.invalidEmail })
    .trim()
    .toLowerCase()
    .email(messages.invalidEmail),
  fullName: fullNameSchema,
  role: roleSchema,
  temporaryPassword: temporaryPasswordSchema,
  memberships: z.array(membershipInputSchema),
});

export type OperatorCreateInput = z.infer<typeof operatorCreateSchema>;

// Update operator - role and memberships only (email immutable after create in this change).
export const operatorUpdateSchema = z.object({
  id: z.string({ required_error: messages.idRequired }).uuid(messages.idRequired),
  role: roleSchema,
  memberships: z.array(membershipInputSchema),
});

export type OperatorUpdateInput = z.infer<typeof operatorUpdateSchema>;

// Deactivate / reactivate - soft flag only; hard delete is out of scope.
export const operatorDeactivateSchema = z.object({
  id: z.string({ required_error: messages.idRequired }).uuid(messages.idRequired),
  isActive: z.boolean(),
});

export type OperatorDeactivateInput = z.infer<typeof operatorDeactivateSchema>;

// Directory membership - area name for list rows.
export const operatorMembershipSchema = z.object({
  areaId: z.string().uuid(),
  areaName: z.string().min(1),
  isLead: z.boolean(),
});

// Directory row - email, role, active flag and assigned areas.
export const operatorDirectorySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  fullName: z.string().min(1),
  role: roleSchema,
  isActive: z.boolean(),
  deactivatedAt: z.string().datetime().nullable(),
  memberships: z.array(operatorMembershipSchema),
});

export type OperatorDirectoryEntry = z.infer<typeof operatorDirectorySchema>;
