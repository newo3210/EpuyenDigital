import type { EvolutionWebhook, JobPayload } from "@epuyen/shared";
import { verifyWebhookSecret } from "./webhook-secret";

// Inbound repository - persist message idempotently and enqueue process_inbound

export type LineContext = {
  lineId: string;
  orgId: string;
  instance: string;
  webhookSecret: string | null;
};

export type PersistResult =
  | { status: "inserted"; messageId: string }
  | { status: "duplicate"; messageId: string }
  | { status: "ignored" };

export type InboundStore = {
  findLineByInstance(instance: string): Promise<LineContext | null>;
  persistInbound(params: {
    line: LineContext;
    event: EvolutionWebhook;
  }): Promise<PersistResult>;
  enqueueJob(payload: JobPayload): Promise<void>;
};

// MemoryInboundStore - in-memory fake for webhook unit tests
export class MemoryInboundStore implements InboundStore {
  lines = new Map<string, LineContext>();
  messages = new Map<
    string,
    { id: string; event: EvolutionWebhook; direction: "inbound" | "outbound" }
  >();
  jobs: JobPayload[] = [];

  async findLineByInstance(instance: string): Promise<LineContext | null> {
    return this.lines.get(instance) ?? null;
  }

  async persistInbound(params: {
    line: LineContext;
    event: EvolutionWebhook;
  }): Promise<PersistResult> {
    const key = `${params.line.lineId}:${params.event.externalId}`;
    const existing = this.messages.get(key);
    if (existing) {
      return { status: "duplicate", messageId: existing.id };
    }
    const id = crypto.randomUUID();
    const direction = params.event.fromMe ? "outbound" : "inbound";
    this.messages.set(key, { id, event: params.event, direction });
    return { status: "inserted", messageId: id };
  }

  async enqueueJob(payload: JobPayload): Promise<void> {
    this.jobs.push(payload);
  }
}

// ingestInboundEvent - application-ish orchestration called from thin route
export async function ingestInboundEvent(
  store: InboundStore,
  event: EvolutionWebhook,
  providedSecret?: string | null,
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const line = await store.findLineByInstance(event.instance);
  if (!line) {
    return { httpStatus: 404, body: { ok: false, code: "LINE_NOT_FOUND" } };
  }

  // Per-line webhook secret is source of truth (spec: 503 if null)
  const secretCheck = verifyWebhookSecret(line.webhookSecret, providedSecret);
  if (!secretCheck.ok) {
    return {
      httpStatus: secretCheck.status,
      body: { ok: false, code: secretCheck.code },
    };
  }

  const persisted = await store.persistInbound({ line, event });
  if (persisted.status === "ignored") {
    return { httpStatus: 200, body: { ok: true, ignored: true } };
  }

  // fromMe: persist as phone outbound echo; do not drive the bot
  if (event.fromMe) {
    return {
      httpStatus: 200,
      body: {
        ok: true,
        ignored: true,
        reason: "from_me",
        messageId: persisted.messageId,
      },
    };
  }

  if (persisted.status === "inserted") {
    await store.enqueueJob({
      type: "process_inbound",
      messageId: persisted.messageId,
      lineId: line.lineId,
      orgId: line.orgId,
    });
  }

  return {
    httpStatus: 200,
    body: {
      ok: true,
      duplicate: persisted.status === "duplicate",
      messageId: persisted.messageId,
    },
  };
}
