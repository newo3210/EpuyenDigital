import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MemoryEvolutionClient } from "../../infrastructure/evolution/client.js";
import { MemoryWorkerStore } from "../../infrastructure/memory-store.js";
import { MemoryVisionClient } from "../../infrastructure/llm/vision-client.js";
import { processOneJob } from "../../jobs/consumer.js";
import type { JobContext } from "../../jobs/types.js";

const locationHelpPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../assets/inspectoria/location-help.png",
);

async function drain(ctx: JobContext, max = 50) {
  for (let i = 0; i < max; i++) {
    if (!(await processOneJob(ctx))) break;
  }
}

async function inbound(
  store: MemoryWorkerStore,
  ctx: JobContext,
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
  await drain(ctx);
  return id;
}

function makeCtx(store: MemoryWorkerStore): JobContext {
  const evolution = new MemoryEvolutionClient();
  evolution.media.set("https://cdn.example/pet.jpg", {
    bytes: new Uint8Array([1, 2, 3, 4]),
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
    locationHelpImagePath: locationHelpPath,
  };
}

describe("registration flow UX v2", () => {
  it("runs welcome→citizen→help→location→animal→photo→complete with EPU id", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);

    await inbound(store, ctx, { kind: "text", body: "hola" });
    await inbound(store, ctx, { kind: "text", body: "ok" }); // welcome → full_name
    await inbound(store, ctx, { kind: "text", body: "Ana Pérez" });
    await inbound(store, ctx, { kind: "text", body: "30111222" });
    await inbound(store, ctx, { kind: "text", body: "Calle Falsa 123" });
    await inbound(store, ctx, { kind: "text", body: "1" }); // location help Sí
    const helpOutbound = store.outbounds.find((o) => o.text.includes("[media:"));
    expect(helpOutbound).toBeTruthy();
    await inbound(store, ctx, {
      kind: "location",
      latitude: -42.244,
      longitude: -71.37,
    });
    await inbound(store, ctx, { kind: "text", body: "Luna" });
    await inbound(store, ctx, { kind: "text", body: "1" }); // dog
    await inbound(store, ctx, { kind: "text", body: "2" }); // female
    await inbound(store, ctx, { kind: "text", body: "mestiza negra" });
    await inbound(store, ctx, { kind: "text", body: "2" }); // medium
    await inbound(store, ctx, { kind: "text", body: "adulto" });
    await inbound(store, ctx, { kind: "text", body: "1" }); // sterilized yes
    await inbound(store, ctx, { kind: "text", body: "3" }); // rabies unknown
    await inbound(store, ctx, { kind: "text", body: "No" }); // health card
    const photoId = await inbound(store, ctx, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
    });
    await drain(ctx);
    await inbound(store, ctx, { kind: "text", body: "listo" });
    await drain(ctx);

    expect(store.citizens.length).toBe(1);
    expect(store.citizens[0]?.latitude).toBeCloseTo(-42.244);
    expect(store.citizens[0]?.privacyConsentAt).toBeNull();
    expect(store.animals.length).toBe(1);
    expect(store.animals[0]?.status).toBe("active");
    expect(store.animals[0]?.municipalId).toMatch(/^EPU-\d{4}-\d{5}$/);
    expect(store.photos.length).toBeGreaterThanOrEqual(1);
    const confirmation = store.outbounds.find(
      (o) =>
        o.text.includes(store.animals[0]!.municipalId) &&
        o.text.includes("Ana Pérez") &&
        o.text.includes("Luna"),
    );
    expect(confirmation).toBeTruthy();
    expect(store.messages.get(photoId)?.storagePath || store.storage.size).toBeTruthy();
  });

  it("skips GPS with No puedo ahora and still completes", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);

    await inbound(store, ctx, { kind: "text", body: "hola" });
    await inbound(store, ctx, { kind: "text", body: "ok" });
    await inbound(store, ctx, { kind: "text", body: "Ana Pérez" });
    await inbound(store, ctx, { kind: "text", body: "30111222" });
    await inbound(store, ctx, { kind: "text", body: "Calle Falsa 123" });
    await inbound(store, ctx, { kind: "text", body: "2" }); // skip help
    await inbound(store, ctx, { kind: "text", body: "No puedo ahora" });
    await inbound(store, ctx, { kind: "text", body: "Luna" });
    await inbound(store, ctx, { kind: "text", body: "1" });
    await inbound(store, ctx, { kind: "text", body: "2" });
    await inbound(store, ctx, { kind: "text", body: "mestiza" });
    await inbound(store, ctx, { kind: "text", body: "2" });
    await inbound(store, ctx, { kind: "text", body: "adulto" });
    await inbound(store, ctx, { kind: "text", body: "1" });
    await inbound(store, ctx, { kind: "text", body: "1" });
    await inbound(store, ctx, { kind: "text", body: "No" });
    await inbound(store, ctx, {
      kind: "image",
      mediaUrl: "https://cdn.example/pet.jpg",
    });
    await drain(ctx);
    await inbound(store, ctx, { kind: "text", body: "OK" });
    await drain(ctx);

    expect(store.citizens[0]?.latitude).toBeNull();
    expect(store.animals[0]?.latitude).toBeNull();
    expect(store.animals[0]?.municipalId).toMatch(/^EPU-/);
  });

  it("greets returning citizen by name", async () => {
    const store = new MemoryWorkerStore();
    const citizen = await store.upsertCitizenFromPayload({
      orgId: store.line.orgId,
      phone: "5492222333444",
      payload: {
        fullName: "Carlos Gómez",
        documentId: "20111222",
        addressLine: "Ruta 40",
        latitude: -42,
        longitude: -71,
      },
    });
    expect(citizen.fullName).toBe("Carlos Gómez");

    const ctx = makeCtx(store);

    await inbound(store, ctx, {
      kind: "text",
      body: "hola",
      phone: "5492222333444",
    });
    const greet = store.outbounds.find((o) => o.text.includes("Carlos Gómez"));
    expect(greet).toBeTruthy();
  });

  it("resumes within TTL and resets after expiry to welcome", async () => {
    const store = new MemoryWorkerStore();
    const ctx = makeCtx(store);

    await inbound(store, ctx, { kind: "text", body: "hola", phone: "5493333444555" });
    await inbound(store, ctx, { kind: "text", body: "ok", phone: "5493333444555" });
    const session = [...store.sessions.values()][0]!;
    expect(session.step).toBe("full_name");

    await inbound(store, ctx, { kind: "text", body: "María", phone: "5493333444555" });
    expect([...store.sessions.values()][0]?.step).toBe("document_id");

    store.seedSession({
      phone: "5493333444555",
      step: "species",
      payload: { animalName: "Toby" },
      expiresAt: new Date(Date.now() - 1000),
    });
    await inbound(store, ctx, { kind: "text", body: "hola", phone: "5493333444555" });
    const after = [...store.sessions.values()][0]!;
    expect(after.step).toBe("welcome");
    expect(after.payload.animalName).toBeUndefined();
  });
});
