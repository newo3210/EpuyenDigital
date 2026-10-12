import { describe, expect, it } from "vitest";
import { MemoryEvolutionClient } from "../../infrastructure/evolution/client.js";
import { MemoryWorkerStore } from "../../infrastructure/memory-store.js";
import { MemoryVisionClient } from "../../infrastructure/llm/vision-client.js";
import { processOneJob } from "../../jobs/consumer.js";
import { handleProcessInbound } from "../../jobs/process-inbound.js";
import type { JobContext } from "../../jobs/types.js";

async function drain(ctx: JobContext, max = 80) {
  for (let i = 0; i < max; i++) {
    if (!(await processOneJob(ctx))) break;
  }
}

async function enqueueInbound(
  store: MemoryWorkerStore,
  partial: {
    kind: string;
    body?: string | null;
    mediaUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    phone?: string;
  },
) {
  const id = crypto.randomUUID();
  store.seedMessage({
    id,
    orgId: store.line.orgId,
    lineId: store.line.id,
    phoneNormalized: partial.phone ?? "5491111222333",
    kind: partial.kind,
    body: partial.body ?? null,
    mediaUrl: partial.mediaUrl ?? null,
    mediaMime: partial.mediaUrl ? "image/jpeg" : null,
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    storagePath: null,
  });
  await store.enqueueJob(store.line.orgId, {
    type: "process_inbound",
    messageId: id,
    lineId: store.line.id,
    orgId: store.line.orgId,
  });
  return id;
}

/** Run process_inbound for a message without claiming/draining download_media jobs. */
async function runProcessInbound(
  ctx: JobContext,
  store: MemoryWorkerStore,
  messageId: string,
) {
  await handleProcessInbound(
    {
      type: "process_inbound",
      messageId,
      lineId: store.line.id,
      orgId: store.line.orgId,
    },
    ctx,
  );
}

async function advanceToPhotos(store: MemoryWorkerStore, ctx: JobContext, phone: string) {
  await enqueueInbound(store, { kind: "text", body: "hola", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "Acepto", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "Ana Pérez", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "30111222", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "Calle Falsa 123", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "Centro", phone });
  await drain(ctx);
  await enqueueInbound(store, {
    kind: "location",
    latitude: -42.244,
    longitude: -71.37,
    phone,
  });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "Luna", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "1", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "2", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "mestiza negra", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "2", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "adulto", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "1", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "1", phone });
  await drain(ctx);
  await enqueueInbound(store, { kind: "text", body: "saltar", phone });
  await drain(ctx);
}

function makeCtx(store: MemoryWorkerStore): JobContext {
  const evolution = new MemoryEvolutionClient();
  evolution.media.set("https://cdn.example/pet.jpg", {
    bytes: new Uint8Array([1, 2, 3, 4]),
    mime: "image/jpeg",
  });
  evolution.media.set("https://cdn.example/card.jpg", {
    bytes: new Uint8Array([5, 6, 7]),
    mime: "image/jpeg",
  });
  return {
    store,
    evolution,
    vision: new MemoryVisionClient(() => ({
      summary: "ok",
      colors: ["negro"],
      markings: [],
      notableFeatures: [],
    })),
    petRegistryEnabled: true,
    defaultSendMode: "dry_run",
    defaultAllowlist: ["5492944216586"],
  };
}

describe("adversarial fixes", () => {
  it("photo→listo race waits for storagePath (no mid-drain)", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);
    const phone = "5491111222333";
    await advanceToPhotos(store, ctx, phone);

    const photoId = await enqueueInbound(store, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
      phone,
    });
    // Process inbound only — leave download_media pending (do not drain)
    await runProcessInbound(ctx, store, photoId);
    expect(store.messages.get(photoId)?.storagePath).toBeNull();

    const listoId = await enqueueInbound(store, { kind: "text", body: "listo", phone });
    await runProcessInbound(ctx, store, listoId);

    const saving = store.outbounds.some((o) =>
      o.text.toLowerCase().includes("guardando la foto"),
    );
    const session = [...store.sessions.values()][0]!;
    expect(saving || session.step === "animal_photos").toBe(true);
    expect(store.animals.length).toBe(0);

    // Finish after media drains
    await drain(ctx);
    const listo2 = await enqueueInbound(store, { kind: "text", body: "listo", phone });
    await runProcessInbound(ctx, store, listo2);
    await drain(ctx);

    expect(store.animals.length).toBe(1);
    expect(store.photos.filter((p) => p.kind === "animal").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("double finish creates only one animal", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);
    const phone = "5491111333444";
    await advanceToPhotos(store, ctx, phone);

    await enqueueInbound(store, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
      phone,
    });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "listo", phone });
    await drain(ctx);
    expect(store.animals.length).toBe(1);

    await enqueueInbound(store, { kind: "text", body: "listo", phone });
    await drain(ctx);
    expect(store.animals.length).toBe(1);
    expect([...store.sessions.values()][0]?.payload.completedAnimalId).toBeTruthy();
  });

  it("links health_card kind from pending media metadata", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);
    const phone = "5491111444555";

    await enqueueInbound(store, { kind: "text", body: "hola", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "Acepto", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "Ana Pérez", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "30111222", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "Calle Falsa 123", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "Centro", phone });
    await drain(ctx);
    await enqueueInbound(store, {
      kind: "location",
      latitude: -42.244,
      longitude: -71.37,
      phone,
    });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "Luna", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "1", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "2", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "mestiza negra", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "2", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "adulto", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "1", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "1", phone });
    await drain(ctx);

    // Health card photo at optional step
    await enqueueInbound(store, {
      kind: "image",
      mediaUrl: "https://cdn.example/card.jpg",
      phone,
    });
    await drain(ctx);
    await enqueueInbound(store, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
      phone,
    });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "listo", phone });
    await drain(ctx);

    expect(store.photos.some((p) => p.kind === "health_card")).toBe(true);
    expect(store.photos.some((p) => p.kind === "animal")).toBe(true);
  });

  it("copies returning citizen geo onto animal completion", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);
    const phone = "5492222333444";
    await store.upsertCitizenFromPayload({
      orgId: store.line.orgId,
      phone,
      payload: {
        fullName: "Carlos Gómez",
        documentId: "20111222",
        addressLine: "Ruta 40",
        neighborhood: "Centro",
        latitude: -42.1,
        longitude: -71.2,
        privacyConsentAt: new Date().toISOString(),
        privacyNoticeVersion: "v1",
      },
    });

    await enqueueInbound(store, { kind: "text", body: "hola", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "1", phone }); // register animal
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "Toby", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "1", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "1", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "mestizo", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "2", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "adulto", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "2", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "2", phone });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "saltar", phone });
    await drain(ctx);
    await enqueueInbound(store, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
      phone,
    });
    await drain(ctx);
    await enqueueInbound(store, { kind: "text", body: "listo", phone });
    await drain(ctx);

    expect(store.animals.length).toBe(1);
    expect(store.animals[0]?.latitude).toBeCloseTo(-42.1);
    expect(store.animals[0]?.longitude).toBeCloseTo(-71.2);
  });

  it("resumes stranded completing session without animal id", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);
    const phone = "5494444555666";
    await advanceToPhotos(store, ctx, phone);
    const photoId = await enqueueInbound(store, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
      phone,
    });
    await drain(ctx);

    const session = [...store.sessions.values()][0]!;
    // Simulate crash after marking completing and before finalize
    session.step = "completing";
    session.payload = {
      ...session.payload,
      pendingMediaMessageIds: [photoId],
      pendingMediaKinds: { [photoId]: "animal" },
      animalPhotoCount: 1,
    };
    delete session.payload.completedAnimalId;
    delete session.payload.completedMunicipalId;
    store.sessions.set(`${session.lineId}:${session.phoneNormalized}`, session);

    expect(store.animals.length).toBe(0);

    await enqueueInbound(store, { kind: "text", body: "hola", phone });
    await drain(ctx);

    expect(store.animals.length).toBe(1);
    expect([...store.sessions.values()][0]?.step).toBe("done");
    expect([...store.sessions.values()][0]?.payload.completedAnimalId).toBeTruthy();
  });

  it("serializes concurrent process_inbound via per-phone mutex", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);
    const phone = "5493333444555";
    await advanceToPhotos(store, ctx, phone);
    await enqueueInbound(store, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
      phone,
    });
    await drain(ctx);

    const a = enqueueInbound(store, { kind: "text", body: "listo", phone }).then(() =>
      processOneJob(ctx),
    );
    const b = enqueueInbound(store, { kind: "text", body: "listo", phone }).then(() =>
      processOneJob(ctx),
    );
    await Promise.all([a, b]);
    await drain(ctx);

    expect(store.animals.length).toBe(1);
  });
});
