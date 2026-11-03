import { jobPayloadSchema } from "@epuyen/shared";
import type { JobContext } from "./types.js";

// download_media - Evolution fetch → private storage → link photo when animal known

export async function handleDownloadMedia(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "download_media") {
    throw new Error("WRONG_JOB_TYPE");
  }

  const message = await ctx.store.getMessage(payload.messageId);
  if (!message) throw new Error("MESSAGE_NOT_FOUND");

  const mime = message.mediaMime ?? "";
  if (!mime.startsWith("image/") && payload.mediaUrl) {
    // Non-image: leave without linking; conversation layer re-prompts
  }

  const downloaded = await ctx.evolution.downloadMedia(payload.mediaUrl);
  if (!downloaded.mime.startsWith("image/")) {
    throw new Error("UNSUPPORTED_MEDIA");
  }

  const path = `${payload.orgId}/animal-media/${payload.messageId}`;
  const stored = await ctx.store.saveMedia({
    orgId: payload.orgId,
    path,
    bytes: downloaded.bytes,
    mime: downloaded.mime,
  });
  await ctx.store.updateMessageStorage(payload.messageId, stored);

  const animalId = payload.sessionId
    ? await ctx.store.getPendingAnimalIdForSession(payload.sessionId)
    : null;

  if (animalId) {
    await ctx.store.linkAnimalPhoto({
      orgId: payload.orgId,
      animalId,
      kind: payload.kind,
      storagePath: stored,
      messageId: payload.messageId,
    });
  }
}
