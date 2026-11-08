import { chunkKnowledgeText, jobPayloadSchema } from "@epuyen/shared";
import type { JobContext } from "./types.js";

// index_document - chunk knowledge body text and replace retrieval units.

export async function handleIndexDocument(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "index_document") throw new Error("WRONG_JOB_TYPE");
  if (!ctx.store.getKnowledgeDocument || !ctx.store.replaceKnowledgeChunks) {
    throw new Error("KNOWLEDGE_STORE_UNAVAILABLE");
  }

  const doc = await ctx.store.getKnowledgeDocument(payload.documentId);
  if (!doc) throw new Error("DOCUMENT_NOT_FOUND");

  let body = doc.bodyText ?? "";
  if (!body && doc.storagePath) {
    try {
      const file = await ctx.store.readStorage(doc.storagePath);
      body = new TextDecoder().decode(file.bytes);
    } catch {
      body = "";
    }
  }

  const chunks = chunkKnowledgeText(body).map((content, chunkIndex) => ({
    chunkIndex,
    content,
    metadata: { model: "text-split-v1" },
  }));

  await ctx.store.replaceKnowledgeChunks(payload.documentId, chunks);
}
