import { z } from 'zod';

// Operator roles - mirrors the Postgres enum user_role.
export const ROLES = ['admin', 'area_lead', 'operator', 'support'] as const;

// Role schema - closed set used by guards and profile contracts.
export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;
