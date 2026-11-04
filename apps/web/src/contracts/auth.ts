import { z } from 'zod';
import { esAR } from '@/i18n/es-AR';

const messages = esAR.auth.errors;

// Login form fields - normalized email plus non-empty password (shared by form and server action).
export const loginSchema = z.object({
  email: z
    .string({ required_error: messages.invalidEmail, invalid_type_error: messages.invalidEmail })
    .trim()
    .toLowerCase()
    .email(messages.invalidEmail),
  password: z
    .string({ required_error: messages.passwordRequired, invalid_type_error: messages.passwordRequired })
    .min(1, messages.passwordRequired),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginField = keyof LoginInput;
