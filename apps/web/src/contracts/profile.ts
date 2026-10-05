import { z } from 'zod';
import { hasVisibleLetter, hasVisibleNameLength } from '@epuyen/shared';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.profile.errors;

// Profile name form - trimmed display name within the database bounds (2-80 code points) with a visible letter or digit.
export const profileNameSchema = z.object({
  fullName: z
    .string({ required_error: messages.nameLength, invalid_type_error: messages.nameLength })
    .trim()
    .min(1, messages.nameLength)
    .refine(hasVisibleLetter, messages.nameVisible)
    .refine(hasVisibleNameLength, messages.nameLength),
});

export type ProfileNameInput = z.infer<typeof profileNameSchema>;

// Avatar limits - mirror the avatars bucket (2 MB, JPEG/PNG/WebP).
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

// Avatar file check - client-side UX pre-check on the browser-declared type and size.
export const avatarFileSchema = z.object({
  type: z.enum(AVATAR_MIME_TYPES, { errorMap: () => ({ message: messages.invalidImage }) }),
  size: z.number().int().positive(messages.invalidImage).max(AVATAR_MAX_BYTES, messages.invalidImage),
});
