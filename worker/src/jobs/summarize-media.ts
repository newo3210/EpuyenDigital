import { jobPayloadSchema } from "@epuyen/shared";
import type { JobContext } from "./types.js";

// summarize_media - write a bot_summary note for image/document attachments.

export async function handleSummarizeMedia(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "summarize_media") throw new Error("WRONG_JOB_TYPE");

  const message = await ctx.store.getMessage(payload.messageId);
  if (!message) throw new Error("MESSAGE_NOT_FOUND");

  const summary = `Resumen automático (${message.kind}): ${
    message.body?.trim() || message.mediaUrl || message.storagePath || "archivo recibido"
  }`;

  await ctx.store.createBotSummaryNote?.({
    orgId: payload.orgId,
    conversationId: payload.conversationId,
    body: summary.slice(0, 4000),
  });
}
