import { jobPayloadSchema } from "@epuyen/shared";
import type { JobContext } from "./types.js";

// transcribe_audio - stub transcription then enqueue bot_reply with text body.

export async function handleTranscribeAudio(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "transcribe_audio") throw new Error("WRONG_JOB_TYPE");

  const message = await ctx.store.getMessage(payload.messageId);
  if (!message) throw new Error("MESSAGE_NOT_FOUND");

  const transcript =
    message.body?.trim() ||
    "[audio] No se pudo transcribir automáticamente; un operador lo revisará.";

  await ctx.store.updateMessageBody?.(payload.messageId, transcript);
  await ctx.store.enqueueJob(payload.orgId, {
    type: "bot_reply",
    messageId: payload.messageId,
    conversationId: payload.conversationId,
    lineId: payload.lineId,
    orgId: payload.orgId,
  });
}
