import { z } from "zod";

// Job payloads - worker job type contracts

export const processInboundJobSchema = z.object({
  type: z.literal("process_inbound"),
  messageId: z.string().uuid(),
  lineId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export const downloadMediaJobSchema = z.object({
  type: z.literal("download_media"),
  messageId: z.string().uuid(),
  orgId: z.string().uuid(),
  mediaUrl: z.string().url(),
  kind: z.enum(["animal", "health_card"]).default("animal"),
  sessionId: z.string().uuid().optional(),
});

export const sendOutboundJobSchema = z.object({
  type: z.literal("send_outbound"),
  lineId: z.string().uuid(),
  phone: z.string().regex(/^549\d+$/),
  text: z.string().min(1).max(4096),
  buttons: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .max(3)
    .optional(),
  /** Absolute or worker-relative path to an image file (e.g. location help) */
  mediaPath: z.string().min(1).optional(),
});

export const analyzeTraitsJobSchema = z.object({
  type: z.literal("analyze_traits"),
  animalId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export const jobPayloadSchema = z.discriminatedUnion("type", [
  processInboundJobSchema,
  downloadMediaJobSchema,
  sendOutboundJobSchema,
  analyzeTraitsJobSchema,
]);

export type JobPayload = z.infer<typeof jobPayloadSchema>;
