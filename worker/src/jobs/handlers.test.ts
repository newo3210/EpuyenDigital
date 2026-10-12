import { describe, expect, it } from "vitest";
import { MemoryEvolutionClient } from "../infrastructure/evolution/client.js";
import { MemoryWorkerStore } from "../infrastructure/memory-store.js";
import { MemoryVisionClient } from "../infrastructure/llm/vision-client.js";
import { processOneJob } from "./consumer.js";
import type { JobContext } from "./types.js";

function makeCtx(
  store: MemoryWorkerStore,
  evolution = new MemoryEvolutionClient(),
  vision: MemoryVisionClient = new MemoryVisionClient(() => ({
    summary: "ok",
    colors: ["negro"],
    markings: [],
    notableFeatures: [],
  })),
): JobContext {
  return {
    store,
    evolution,
    vision,
    petRegistryEnabled: true,
    defaultSendMode: "dry_run",
    defaultAllowlist: ["5492944216586"],
  };
}

async function drain(ctx: JobContext, max = 20) {
  for (let i = 0; i < max; i++) {
    const did = await processOneJob(ctx);
    if (!did) break;
  }
}

describe("job handlers", () => {
  it("process_inbound greets new session and send_outbound dry_run simulates", async () => {
    const store = new MemoryWorkerStore();
    const evolution = new MemoryEvolutionClient();
    const ctx = makeCtx(store, evolution);
    const messageId = crypto.randomUUID();
    store.seedMessage({
      id: messageId,
      orgId: store.line.orgId,
      lineId: store.line.id,
      phoneNormalized: "5491111111111",
      kind: "text",
      body: "hola",
      mediaUrl: null,
      mediaMime: null,
      latitude: null,
      longitude: null,
      storagePath: null,
    });
    await store.enqueueJob(store.line.orgId, {
      type: "process_inbound",
      messageId,
      lineId: store.line.id,
      orgId: store.line.orgId,
    });

    await drain(ctx);

    expect(store.sessions.size).toBe(1);
    expect(store.outbounds.length).toBeGreaterThan(0);
    expect(store.outbounds[0]?.deliveryStatus).toBe("simulated");
    expect(evolution.sent.length).toBe(0);
  });

  it("send_outbound allowlist blocks unknown phone", async () => {
    const store = new MemoryWorkerStore();
    store.settings.sendMode = "allowlist";
    const evolution = new MemoryEvolutionClient();
    const ctx = makeCtx(store, evolution);
    await store.enqueueJob(store.line.orgId, {
      type: "send_outbound",
      lineId: store.line.id,
      phone: "5490000000000",
      text: "hola",
    });
    await drain(ctx);
    expect(store.outbounds[0]?.deliveryStatus).toBe("blocked");
    expect(evolution.sent.length).toBe(0);
  });

  it("download_media stores private object", async () => {
    const store = new MemoryWorkerStore();
    const evolution = new MemoryEvolutionClient();
    evolution.media.set("https://cdn.example/img.jpg", {
      bytes: new Uint8Array([1, 2, 3]),
      mime: "image/jpeg",
    });
    const ctx = makeCtx(store, evolution);
    const messageId = crypto.randomUUID();
    store.seedMessage({
      id: messageId,
      orgId: store.line.orgId,
      lineId: store.line.id,
      phoneNormalized: "5491111111111",
      kind: "image",
      body: null,
      mediaUrl: "https://cdn.example/img.jpg",
      mediaMime: "image/jpeg",
      latitude: null,
      longitude: null,
      storagePath: null,
    });
    await store.enqueueJob(store.line.orgId, {
      type: "download_media",
      messageId,
      orgId: store.line.orgId,
      mediaUrl: "https://cdn.example/img.jpg",
      kind: "animal",
    });
    await drain(ctx);
    const msg = await store.getMessage(messageId);
    expect(msg?.storagePath).toBeTruthy();
    expect(store.storage.size).toBe(1);
  });

  it("download_media failure marks job failed path", async () => {
    const store = new MemoryWorkerStore();
    const evolution = new MemoryEvolutionClient();
    const ctx = makeCtx(store, evolution);
    const messageId = crypto.randomUUID();
    store.seedMessage({
      id: messageId,
      orgId: store.line.orgId,
      lineId: store.line.id,
      phoneNormalized: "5491111111111",
      kind: "image",
      body: null,
      mediaUrl: "https://cdn.example/missing.jpg",
      mediaMime: "image/jpeg",
      latitude: null,
      longitude: null,
      storagePath: null,
    });
    await store.enqueueJob(store.line.orgId, {
      type: "download_media",
      messageId,
      orgId: store.line.orgId,
      mediaUrl: "https://cdn.example/missing.jpg",
      kind: "animal",
    });
    await processOneJob(ctx);
    expect(store.jobs[0]?.status).toBe("pending");
  });

  it("analyze_traits success and failure", async () => {
    const store = new MemoryWorkerStore();
    const animal = await store.completeAnimalRegistration({
      orgId: store.line.orgId,
      citizenId: crypto.randomUUID(),
      payload: {
        animalName: "Luna",
        species: "dog",
        sex: "female",
        breedColor: "negra",
        size: "medium",
        ageStage: "adulto",
        sterilized: "yes",
        rabiesStatus: "up_to_date",
        neighborhood: "Centro",
      },
    });
    await store.saveMedia({
      orgId: store.line.orgId,
      path: "p1",
      bytes: new Uint8Array([9]),
      mime: "image/jpeg",
    });
    await store.linkAnimalPhoto({
      orgId: store.line.orgId,
      animalId: animal.animalId,
      kind: "animal",
      storagePath: "p1",
    });

    const okVision = new MemoryVisionClient(() => ({
      summary: "Perro negro",
      colors: ["negro"],
      markings: [],
      notableFeatures: ["mancha blanca"],
    }));
    const ctxOk = makeCtx(store, new MemoryEvolutionClient(), okVision);
    await store.enqueueJob(store.line.orgId, {
      type: "analyze_traits",
      animalId: animal.animalId,
      orgId: store.line.orgId,
    });
    await drain(ctxOk);
    expect(store.animals[0]?.traitsStatus).toBe("ready");

    const animal2 = await store.completeAnimalRegistration({
      orgId: store.line.orgId,
      citizenId: crypto.randomUUID(),
      payload: {
        animalName: "Michi",
        species: "cat",
        sex: "male",
        breedColor: "naranja",
        size: "small",
        ageStage: "cachorro",
        sterilized: "no",
        rabiesStatus: "pending",
      },
    });
    await store.linkAnimalPhoto({
      orgId: store.line.orgId,
      animalId: animal2.animalId,
      kind: "animal",
      storagePath: "p1",
    });
    const badVision = new MemoryVisionClient(() => {
      throw new Error("boom");
    });
    const ctxBad = makeCtx(store, new MemoryEvolutionClient(), badVision);
    await store.enqueueJob(store.line.orgId, {
      type: "analyze_traits",
      animalId: animal2.animalId,
      orgId: store.line.orgId,
    });
    await drain(ctxBad);
    expect(store.animals[1]?.traitsStatus).toBe("pending_manual");
    expect(store.animals[1]?.status).toBe("active");
  });
});
