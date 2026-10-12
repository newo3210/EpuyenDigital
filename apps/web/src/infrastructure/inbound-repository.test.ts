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
  it("persists once and enqueues process_inbound", async () => {
    const store = new MemoryInboundStore();
    store.lines.set("inspectoria", {
      lineId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      instance: "inspectoria",
      webhookSecret: "secret",
    });

    const first = await ingestInboundEvent(store, baseEvent);
    const second = await ingestInboundEvent(store, baseEvent);

    expect(first.httpStatus).toBe(200);
    expect(second.httpStatus).toBe(200);
    expect(store.messages.size).toBe(1);
    expect(store.jobs.filter((j) => j.type === "process_inbound")).toHaveLength(1);
    expect(second.body.duplicate).toBe(true);
  });
});
