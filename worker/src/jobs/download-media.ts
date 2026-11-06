import { jobPayloadSchema } from "@epuyen/shared";
import type { JobContext } from "./types.js";

// download_media - Evolution fetch → private storage; pet photos only for images

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

  // Idempotent: already stored (channel + pet may both enqueue)
  if (message.storagePath) {
    return;
  }

  const downloaded = await ctx.evolution.downloadMedia(payload.mediaUrl);
  const isImage = downloaded.mime.startsWith("image/");
  const folder = isImage ? "animal-media" : "whatsapp-media";
  const path = `${payload.orgId}/${folder}/${payload.messageId}`;
  const stored = await ctx.store.saveMedia({
    orgId: payload.orgId,
    path,
    bytes: downloaded.bytes,
    mime: downloaded.mime,
  });
  await ctx.store.updateMessageStorage(payload.messageId, stored);

  // Pet registry only links image photos to animals
  if (!isImage) {
    return;
  }

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
