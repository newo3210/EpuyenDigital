import { z } from "zod";

// Outbound text - send entry point payload (operator composer + jobs)
export const outboundTextSchema = z.object({
  phone: z.string().regex(/^549\d+$/),
  text: z.string().min(1).max(4096),
  lineId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  authorUserId: z.string().uuid().optional(),
  buttons: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(20),
      }),
    )
    .max(3)
    .optional(),
});

export type OutboundText = z.infer<typeof outboundTextSchema>;

// Composer body - panel form validation before normalizePhone
export const composerTextSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(4096),
});

export type ComposerTextInput = z.infer<typeof composerTextSchema>;
