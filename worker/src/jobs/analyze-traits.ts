import { jobPayloadSchema } from "@epuyen/shared";
import type { JobContext } from "./types.js";

// analyze_traits - vision LLM → traits_status ready or pending_manual

export async function handleAnalyzeTraits(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "analyze_traits") {
    throw new Error("WRONG_JOB_TYPE");
  }

  const photos = await ctx.store.listAnimalPhotoPaths(payload.animalId);
  if (photos.length === 0) {
    await ctx.store.updateAnimalTraits({
      animalId: payload.animalId,
      traits: null,
      status: "pending_manual",
    });
    return;
  }

  try {
    const images = [];
    for (const photo of photos) {
      const file = await ctx.store.readStorage(photo.path);
      const base64 = Buffer.from(file.bytes).toString("base64");
      images.push({ mime: file.mime, base64 });
    }
    const traits = await ctx.vision.analyzeAnimalPhotos(images);
    await ctx.store.updateAnimalTraits({
      animalId: payload.animalId,
      traits,
      status: "ready",
    });
  } catch {
    await ctx.store.updateAnimalTraits({
      animalId: payload.animalId,
      traits: null,
      status: "pending_manual",
    });
  }
}
