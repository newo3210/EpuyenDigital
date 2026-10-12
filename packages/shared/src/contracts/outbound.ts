import { z } from "zod";

// Outbound text - send entry point payload
export const outboundTextSchema = z.object({
  phone: z.string().regex(/^549\d+$/),
  text: z.string().min(1).max(4096),
  lineId: z.string().uuid(),
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
