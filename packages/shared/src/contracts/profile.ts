import { z } from 'zod';
import { roleSchema } from './roles';

// Full name bounds - match the profiles.full_name check constraint.
export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 80;

// Invisible characters - blanks, zero-width/bidi marks, soft hyphen, Hangul fillers, braille blank,
// variation selectors and tag characters; mirrors the profiles_full_name_trimmed_length check (D13).
const INVISIBLE_CHARS = String.raw`\s\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\u{e0000}-\u{e007f}`;
const EDGE_INVISIBLE_RE = new RegExp(`^[${INVISIBLE_CHARS}]+|[${INVISIBLE_CHARS}]+$`, 'gu');
const ANY_INVISIBLE_RE = new RegExp(`[${INVISIBLE_CHARS}]`, 'gu');
const LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/u;

// Visible length - code points left after trimming invisible characters from both ends.
export function visibleNameLength(value: string): number {
  return [...value.replace(EDGE_INVISIBLE_RE, '')].length;
}

// Visible letter check - at least one letter or number once every invisible character is removed.
export function hasVisibleLetter(value: string): boolean {
  return LETTER_OR_NUMBER_RE.test(value.replace(ANY_INVISIBLE_RE, ''));
}

// Visible bounds check - trimmed visible length within the database bounds.
export function hasVisibleNameLength(value: string): boolean {
  const length = visibleNameLength(value);
  return length >= FULL_NAME_MIN && length <= FULL_NAME_MAX;
}

// Full name schema - trimmed display name reused by profile forms and row validation.
export const fullNameSchema = z
  .string()
  .trim()
  .min(FULL_NAME_MIN)
  .max(FULL_NAME_MAX)
  .refine(hasVisibleLetter)
  .refine(hasVisibleNameLength);

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
