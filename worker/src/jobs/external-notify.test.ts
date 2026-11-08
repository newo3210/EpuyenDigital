import { describe, expect, it } from "vitest";
import { MemoryEvolutionClient } from "../infrastructure/evolution/client.js";
import { MemoryWorkerStore } from "../infrastructure/memory-store.js";
import { MemoryVisionClient } from "../infrastructure/llm/vision-client.js";
import { processOneJob } from "./consumer.js";
import type { JobContext } from "./types.js";

describe("external_notify", () => {
  it("enqueues a protocol send_outbound for the external phone", async () => {
    const store = new MemoryWorkerStore();
    const taskId = crypto.randomUUID();
    store.externalTasks.set(taskId, {
      publicRef: "T-0007",
      title: "Poste caído",
      externalPhone: "5492944123456",
      lineId: store.line.id,
    });
    await store.enqueueJob(store.line.orgId, {
      type: "external_notify",
      taskId,
      orgId: store.line.orgId,
    });

    const ctx: JobContext = {
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
    };

    await processOneJob(ctx);
    await processOneJob(ctx);

    expect(store.outbounds.length).toBe(1);
    expect(store.outbounds[0]?.phone).toBe("5492944123456");
    expect(store.outbounds[0]?.text).toContain("ACEPTO T-0007");
  });
});
