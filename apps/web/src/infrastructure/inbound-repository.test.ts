import { describe, expect, it } from "vitest";
import type { EvolutionWebhook } from "@epuyen/shared";
import {
  ingestDeliveryAck,
  ingestInboundEvent,
  MemoryInboundStore,
} from "./inbound-repository.js";

const line = {
  lineId: "00000000-0000-4000-8000-000000000002",
  orgId: "00000000-0000-4000-8000-000000000001",
  instance: "inspectoria",
  webhookSecret: "secret",
  defaultAreaId: "00000000-0000-4000-8000-000000000010",
} as const;

const baseEvent: EvolutionWebhook = {
  externalId: "wamid.1",
  instance: "inspectoria",
  phoneRaw: "5491111111111",
  phoneNormalized: "5491111111111",
  isGroup: false,
  isBroadcast: false,
  fromMe: false,
  kind: "text",
  text: "hola",
};

describe("ingestInboundEvent", () => {
  it("persists once, upserts conversation, and skips pet enqueue on Mesa without session", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });

    const first = await ingestInboundEvent(store, baseEvent, "secret");
    const second = await ingestInboundEvent(store, baseEvent, "secret");

    expect(first.httpStatus).toBe(200);
    expect(second.httpStatus).toBe(200);
    expect(store.messages.size).toBe(1);
    expect(store.conversations.size).toBe(1);
    expect(store.citizens.size).toBe(1);
    expect(store.jobs.filter((j) => j.type === "process_inbound")).toHaveLength(0);
    expect(typeof first.body.conversationId).toBe("string");
    expect(store.reopenCalls).toContain(String(first.body.conversationId));
    expect(second.body.duplicate).toBe(true);
  });

  it("enqueues process_inbound when conversation area is Inspectoría", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    const original = store.persistInbound.bind(store);
    store.persistInbound = async (params) => {
      const result = await original(params);
      if (result.status !== "ignored") {
        const conversation = [...store.conversations.values()].find(
          (row) => row.id === result.conversationId,
        );
        if (conversation) conversation.areaName = "Inspectoría";
      }
      return result;
    };

    await ingestInboundEvent(store, { ...baseEvent, externalId: "insp-1" }, "secret");
    expect(store.jobs.filter((j) => j.type === "process_inbound")).toHaveLength(1);
  });

  it("enqueues process_inbound on Mesa when an open registration session exists", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    store.registrationSessions.add(`${line.lineId}:${baseEvent.phoneNormalized}`);
    await ingestInboundEvent(store, { ...baseEvent, externalId: "sess-1" }, "secret");
    expect(store.jobs.filter((j) => j.type === "process_inbound")).toHaveLength(1);
  });

  it("returns 503 when line webhook secret is not configured", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line, webhookSecret: null });
    const result = await ingestInboundEvent(store, baseEvent, "secret");
    expect(result.httpStatus).toBe(503);
    expect(result.body.code).toBe("SECRET_NOT_CONFIGURED");
    expect(store.messages.size).toBe(0);
    expect(store.jobs).toHaveLength(0);
  });

  it("returns 503 SECRET_NOT_CONFIGURED when ciphertext decrypt key is missing (no persist)", async () => {
    const store = new MemoryInboundStore();
    store.findLineByInstance = async () => {
      throw new Error("CREDENTIALS_ENCRYPTION_KEY_MISSING");
    };
    const result = await ingestInboundEvent(store, baseEvent, "secret");
    expect(result.httpStatus).toBe(503);
    expect(result.body.code).toBe("SECRET_NOT_CONFIGURED");
    expect(store.messages.size).toBe(0);
    expect(store.jobs).toHaveLength(0);
  });

  it("returns 401 when provided secret does not match line secret", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    const result = await ingestInboundEvent(store, baseEvent, "wrong");
    expect(result.httpStatus).toBe(401);
    expect(store.jobs).toHaveLength(0);
  });

  it("persists fromMe as outbound echo without enqueueing process_inbound", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    const result = await ingestInboundEvent(
      store,
      { ...baseEvent, externalId: "from-me-1", fromMe: true },
      "secret",
    );
    expect(result.httpStatus).toBe(200);
    expect(result.body.reason).toBe("from_me");
    expect(store.messages.size).toBe(1);
    expect([...store.messages.values()][0]?.direction).toBe("outbound");
    expect(store.jobs.filter((j) => j.type === "process_inbound")).toHaveLength(0);
  });

  it("enqueues download_media for inbound images", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    await ingestInboundEvent(
      store,
      {
        ...baseEvent,
        externalId: "img-1",
        kind: "image",
        mediaUrl: "https://cdn.example.com/a.jpg",
        mediaMime: "image/jpeg",
      },
      "secret",
    );
    expect(store.jobs.filter((j) => j.type === "download_media")).toHaveLength(1);
  });

  it("captures pushName on citizen stub", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    await ingestInboundEvent(
      store,
      { ...baseEvent, externalId: "pn-1", pushName: "Juan" },
      "secret",
    );
    expect([...store.citizens.values()][0]?.pushName).toBe("Juan");
  });
});

describe("ingestDeliveryAck", () => {
  it("updates outbound delivery_status for matching external id", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    await ingestInboundEvent(
      store,
      { ...baseEvent, externalId: "out-1", fromMe: true, text: "hola operador" },
      "secret",
    );
    const result = await ingestDeliveryAck(
      store,
      {
        type: "delivery_ack",
        instance: "inspectoria",
        externalId: "out-1",
        deliveryStatus: "delivered",
      },
      "secret",
    );
    expect(result.httpStatus).toBe(200);
    expect(result.body.updated).toBe(true);
    expect([...store.messages.values()][0]?.deliveryStatus).toBe("delivered");
  });

  it("rejects delivery ACK without secret", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", { ...line });
    const result = await ingestDeliveryAck(
      store,
      {
        type: "delivery_ack",
        instance: "inspectoria",
        externalId: "out-1",
        deliveryStatus: "read",
      },
      null,
    );
    expect(result.httpStatus).toBe(401);
  });
});
