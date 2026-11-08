import { describe, expect, it } from "vitest";
import { MemoryEvolutionClient } from "../infrastructure/evolution/client.js";
import { MemoryVisionClient } from "../infrastructure/llm/vision-client.js";
import { MemoryWorkerStore } from "../infrastructure/memory-store.js";
import { handleBotReply } from "./bot-reply.js";
import type { JobContext } from "./types.js";

function ctx(store: MemoryWorkerStore): JobContext {
  return {
    store,
    evolution: new MemoryEvolutionClient(),
    vision: new MemoryVisionClient(() => ({
      summary: "ok",
      colors: [],
      markings: [],
      notableFeatures: [],
    })),
    petRegistryEnabled: true,
    defaultSendMode: "dry_run",
    defaultAllowlist: [],
    mesaBotEnabled: true,
    botKillSwitch: false,
  };
}

describe("handleBotReply", () => {
  it("stays silent when an open pet session exists and still records the run", async () => {
    const store = new MemoryWorkerStore();
    const messageId = crypto.randomUUID();
    const conversationId = crypto.randomUUID();
    store.seedMessage({
      id: messageId,
      orgId: store.line.orgId,
      lineId: store.line.id,
      phoneNormalized: "5492944000000",
      kind: "text",
      body: "hola",
      mediaUrl: null,
      mediaMime: null,
      latitude: null,
      longitude: null,
      storagePath: null,
    });
    store.seedConversation({
      id: conversationId,
      orgId: store.line.orgId,
      lineId: store.line.id,
      phoneNormalized: "5492944000000",
      ownerUserId: null,
      botState: "active",
      privacyNoticeSentAt: new Date().toISOString(),
      handoffAckSentAt: null,
      botAwaitingClarification: false,
    });
    store.seedSession({ phone: "5492944000000", step: "animal_name" });

    await handleBotReply(
      {
        type: "bot_reply",
        messageId,
        conversationId,
        lineId: store.line.id,
        orgId: store.line.orgId,
      },
      ctx(store),
    );

    expect(store.botRuns).toHaveLength(1);
    expect(store.botRuns[0]?.decision).toBe("silent");
    expect(store.jobs.filter((job) => job.payload.type === "send_outbound")).toHaveLength(0);
  });

  it("answers from knowledge hits after privacy was already sent", async () => {
    const store = new MemoryWorkerStore();
    const messageId = crypto.randomUUID();
    const conversationId = crypto.randomUUID();
    store.seedMessage({
      id: messageId,
      orgId: store.line.orgId,
      lineId: store.line.id,
      phoneNormalized: "5492944000001",
      kind: "text",
      body: "rentas",
      mediaUrl: null,
      mediaMime: null,
      latitude: null,
      longitude: null,
      storagePath: null,
    });
    store.seedConversation({
      id: conversationId,
      orgId: store.line.orgId,
      lineId: store.line.id,
      phoneNormalized: "5492944000001",
      ownerUserId: null,
      botState: "active",
      privacyNoticeSentAt: new Date().toISOString(),
      handoffAckSentAt: null,
      botAwaitingClarification: false,
    });
    store.knowledgeHits.push({
      chunkId: crypto.randomUUID(),
      documentId: crypto.randomUUID(),
      title: "Rentas",
      content: "Rentas atiende de 8 a 14 hs.",
      score: 0.92,
    });

    await handleBotReply(
      {
        type: "bot_reply",
        messageId,
        conversationId,
        lineId: store.line.id,
        orgId: store.line.orgId,
      },
      ctx(store),
    );

    expect(store.botRuns[0]?.decision).toBe("answered");
    expect(store.jobs.some((job) => job.payload.type === "send_outbound")).toBe(true);
  });
});
