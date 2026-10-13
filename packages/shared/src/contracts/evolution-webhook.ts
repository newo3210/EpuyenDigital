import { z } from "zod";

// Evolution webhook - normalized inbound event from WhatsApp/Evolution

export const evolutionInboundKindSchema = z.enum([
  "text",
  "image",
  "location",
  "button_reply",
  "unknown",
]);

export const evolutionWebhookSchema = z.object({
  externalId: z.string().min(1),
  instance: z.string().min(1),
  phoneRaw: z.string().min(1),
  phoneNormalized: z.string().regex(/^549\d+$/),
  isGroup: z.boolean().default(false),
  isBroadcast: z.boolean().default(false),
  fromMe: z.boolean().default(false),
  kind: evolutionInboundKindSchema,
  text: z.string().max(4096).optional(),
  mediaUrl: z.string().url().optional(),
  mediaMime: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  buttonId: z.string().optional(),
  pushName: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
});

export type EvolutionWebhook = z.infer<typeof evolutionWebhookSchema>;

// rawEvolutionEnvelopeSchema - loose Evolution API v2 shape before normalize
export const rawEvolutionEnvelopeSchema = z
  .object({
    event: z.string().optional(),
    instance: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  })
  .passthrough();
