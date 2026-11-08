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
  senderKind: z.enum(["bot", "operator", "system"]).optional(),
});

export const analyzeTraitsJobSchema = z.object({
  type: z.literal("analyze_traits"),
  animalId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export const externalNotifyJobSchema = z.object({
  type: z.literal("external_notify"),
  taskId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export const botReplyJobSchema = z.object({
  type: z.literal("bot_reply"),
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  lineId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export const indexDocumentJobSchema = z.object({
  type: z.literal("index_document"),
  documentId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export const transcribeAudioJobSchema = z.object({
  type: z.literal("transcribe_audio"),
  messageId: z.string().uuid(),
  orgId: z.string().uuid(),
  conversationId: z.string().uuid(),
  lineId: z.string().uuid(),
});

export const summarizeMediaJobSchema = z.object({
  type: z.literal("summarize_media"),
  messageId: z.string().uuid(),
  orgId: z.string().uuid(),
  conversationId: z.string().uuid(),
});

export const jobPayloadSchema = z.discriminatedUnion("type", [
  processInboundJobSchema,
  downloadMediaJobSchema,
  sendOutboundJobSchema,
  analyzeTraitsJobSchema,
  externalNotifyJobSchema,
  botReplyJobSchema,
  indexDocumentJobSchema,
  transcribeAudioJobSchema,
  summarizeMediaJobSchema,
]);

export type JobPayload = z.infer<typeof jobPayloadSchema>;
