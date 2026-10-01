import { z } from 'zod';
import { roleSchema } from './roles';

// Full name bounds - match the profiles.full_name check constraint.
export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 80;

// Full name schema - trimmed display name reused by profile forms.
export const fullNameSchema = z.string().trim().min(FULL_NAME_MIN).max(FULL_NAME_MAX);

// Profile entity - operator identity, organization, role and activation state.
export const profileSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  fullName: fullNameSchema,
  avatarPath: z.string().min(1).nullable(),
  role: roleSchema,
  isActive: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
