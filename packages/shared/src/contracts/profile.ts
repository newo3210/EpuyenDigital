import { z } from 'zod';
import { roleSchema } from './roles';

// Full name bounds - match the profiles.full_name check constraint.
export const FULL_NAME_MIN = 2;
export const FULL_NAME_MAX = 80;

// Invisible characters - blanks, zero-width/bidi marks, soft hyphen, Hangul fillers, braille blank,
// variation selectors, tag characters and the assigned default-ignorables; mirrors the
// profiles_full_name_trimmed_length check (D14), plus the blanks ICU [[:space:]] adds over JS \s.
const INVISIBLE_CHARS = String.raw`\s\u001c-\u001f\u0085\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8\u{1bca0}-\u{1bca3}\u{1d173}-\u{1d17a}\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}`;
const EDGE_INVISIBLE_RE = new RegExp(`^[${INVISIBLE_CHARS}]+|[${INVISIBLE_CHARS}]+$`, 'gu');
const ANY_INVISIBLE_RE = new RegExp(`[${INVISIBLE_CHARS}]`, 'gu');
const LETTER_OR_NUMBER_RE = /[\p{L}\p{Nd}]/u;

// Visible length - code points left after trimming invisible characters from both ends.
export function visibleNameLength(value: string): number {
  return [...value.replace(EDGE_INVISIBLE_RE, '')].length;
}

// Visible letter check - at least one letter or decimal digit (ICU [[:alnum:]]) once invisibles are removed.
export function hasVisibleLetter(value: string): boolean {
  return LETTER_OR_NUMBER_RE.test(value.replace(ANY_INVISIBLE_RE, ''));
}

// Visible bounds check - trimmed visible length within the database bounds.
export function hasVisibleNameLength(value: string): boolean {
  const length = visibleNameLength(value);
  return length >= FULL_NAME_MIN && length <= FULL_NAME_MAX;
}

// Raw bounds check - whole value within the database bounds in code points (profiles_full_name_check).
export function hasRawNameLength(value: string): boolean {
  const length = [...value].length;
  return length >= FULL_NAME_MIN && length <= FULL_NAME_MAX;
}

// Full name schema - trimmed display name for writes; bounds counted in code points like char_length.
export const fullNameSchema = z
  .string()
  .trim()
  .min(1)
  .refine(hasVisibleLetter)
  .refine(hasVisibleNameLength)
  .refine(hasRawNameLength);

// Profile entity - operator identity, organization, role and activation state; the name is only
// required non-empty so a row the database accepted is never rejected on read (D14).
export const profileSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  fullName: z.string().min(1),
  avatarPath: z.string().min(1).nullable(),
  role: roleSchema,
  isActive: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
