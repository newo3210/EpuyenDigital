import { describe, expect, it } from "vitest";
import type { EvolutionWebhook } from "@epuyen/shared";
import { ingestInboundEvent, MemoryInboundStore } from "./inbound-repository.js";

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
  it("persists once and enqueues process_inbound when line secret matches", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", {
      lineId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      instance: "inspectoria",
      webhookSecret: "secret",
    });

    const first = await ingestInboundEvent(store, baseEvent, "secret");
    const second = await ingestInboundEvent(store, baseEvent, "secret");

    expect(first.httpStatus).toBe(200);
    expect(second.httpStatus).toBe(200);
    expect(store.messages.size).toBe(1);
    expect(store.jobs.filter((j) => j.type === "process_inbound")).toHaveLength(1);
    expect(second.body.duplicate).toBe(true);
  });

  it("returns 503 when line webhook secret is not configured", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", {
      lineId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      instance: "inspectoria",
      webhookSecret: null,
    });
    const result = await ingestInboundEvent(store, baseEvent, "secret");
    expect(result.httpStatus).toBe(503);
    expect(result.body.code).toBe("SECRET_NOT_CONFIGURED");
    expect(store.messages.size).toBe(0);
    expect(store.jobs).toHaveLength(0);
  });

  it("returns 401 when provided secret does not match line secret", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", {
      lineId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      instance: "inspectoria",
      webhookSecret: "secret",
    });
    const result = await ingestInboundEvent(store, baseEvent, "wrong");
    expect(result.httpStatus).toBe(401);
    expect(store.jobs).toHaveLength(0);
  });

  it("persists fromMe as outbound echo without enqueueing process_inbound", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", {
      lineId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      instance: "inspectoria",
      webhookSecret: "secret",
    });
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
});
