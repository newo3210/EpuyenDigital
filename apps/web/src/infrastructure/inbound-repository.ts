import type { DeliveryAck, EvolutionWebhook, JobPayload } from "@epuyen/shared";
import { verifyWebhookSecret } from "./webhook-secret";

// Inbound repository - persist message idempotently, upsert conversation, enqueue jobs

export type LineContext = {
  lineId: string;
  orgId: string;
  instance: string;
  webhookSecret: string | null;
  defaultAreaId: string | null;
};

export type PersistResult =
  | { status: "inserted"; messageId: string; conversationId: string }
  | { status: "duplicate"; messageId: string; conversationId: string }
  | { status: "ignored" };

export type InboundStore = {
  findLineByInstance(instance: string): Promise<LineContext | null>;
  persistInbound(params: {
    line: LineContext;
    event: EvolutionWebhook;
  }): Promise<PersistResult>;
  applyDeliveryAck(params: {
    line: LineContext;
    ack: DeliveryAck;
  }): Promise<{ updated: boolean }>;
  enqueueJob(payload: JobPayload): Promise<void>;
};

const MEDIA_KINDS = new Set(["image", "audio", "video", "document", "sticker"]);

// MemoryInboundStore - in-memory fake for webhook unit tests
export class MemoryInboundStore implements InboundStore {
  lines = new Map<string, LineContext>();
  messages = new Map<
    string,
    {
      id: string;
      event: EvolutionWebhook;
      direction: "inbound" | "outbound";
      conversationId: string;
      deliveryStatus?: string;
    }
  >();
  conversations = new Map<
    string,
    { id: string; orgId: string; lineId: string; phone: string; areaId: string; citizenId?: string }
  >();
  citizens = new Map<
    string,
    { id: string; orgId: string; phone: string; pushName?: string; avatarUrl?: string }
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
      return {
        status: "duplicate",
        messageId: existing.id,
        conversationId: existing.conversationId,
      };
    }

    const convKey = `${params.line.orgId}:${params.line.lineId}:${params.event.phoneNormalized}`;
    let conversation = this.conversations.get(convKey);
    if (!conversation) {
      const citizenKey = `${params.line.orgId}:${params.event.phoneNormalized}`;
      let citizen = this.citizens.get(citizenKey);
      if (!citizen) {
        citizen = {
          id: crypto.randomUUID(),
          orgId: params.line.orgId,
          phone: params.event.phoneNormalized,
          pushName: params.event.pushName,
          avatarUrl: params.event.avatarUrl,
        };
        this.citizens.set(citizenKey, citizen);
      } else if (params.event.pushName && !citizen.pushName) {
        citizen.pushName = params.event.pushName;
      }
      conversation = {
        id: crypto.randomUUID(),
        orgId: params.line.orgId,
        lineId: params.line.lineId,
        phone: params.event.phoneNormalized,
        areaId: params.line.defaultAreaId ?? "00000000-0000-4000-8000-000000000010",
        citizenId: citizen.id,
      };
      this.conversations.set(convKey, conversation);
    }

    const id = crypto.randomUUID();
    const direction = params.event.fromMe ? "outbound" : "inbound";
    this.messages.set(key, {
      id,
      event: params.event,
      direction,
      conversationId: conversation.id,
    });
    return { status: "inserted", messageId: id, conversationId: conversation.id };
  }

  async applyDeliveryAck(params: {
    line: LineContext;
    ack: DeliveryAck;
  }): Promise<{ updated: boolean }> {
    for (const [key, row] of this.messages) {
      if (
        key.startsWith(`${params.line.lineId}:`) &&
        row.event.externalId === params.ack.externalId
      ) {
        row.deliveryStatus = params.ack.deliveryStatus;
        return { updated: true };
      }
    }
    return { updated: false };
  }

  async enqueueJob(payload: JobPayload): Promise<void> {
    this.jobs.push(payload);
  }
}

function isSecretConfigError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === "CREDENTIALS_ENCRYPTION_KEY_MISSING" ||
    error.message === "CREDENTIALS_ENCRYPTION_KEY_INVALID" ||
    error.message === "CIPHERTEXT_FORMAT_INVALID" ||
    error.message === "SECRET_DECRYPT_FAILED" ||
    error.name === "CredentialsKeyError"
  );
}

async function resolveLineOrSecretError(
  store: InboundStore,
  instance: string,
): Promise<
  | { ok: true; line: LineContext }
  | { ok: false; httpStatus: number; body: Record<string, unknown> }
> {
  try {
    const line = await store.findLineByInstance(instance);
    if (!line) {
      return { ok: false, httpStatus: 404, body: { ok: false, code: "LINE_NOT_FOUND" } };
    }
    return { ok: true, line };
  } catch (error) {
    if (isSecretConfigError(error)) {
      return {
        ok: false,
        httpStatus: 503,
        body: { ok: false, code: "SECRET_NOT_CONFIGURED" },
      };
    }
    throw error;
  }
}

// ingestInboundEvent - application orchestration called from thin route
export async function ingestInboundEvent(
  store: InboundStore,
  event: EvolutionWebhook,
  providedSecret?: string | null,
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const resolved = await resolveLineOrSecretError(store, event.instance);
  if (!resolved.ok) return { httpStatus: resolved.httpStatus, body: resolved.body };
  const line = resolved.line;

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
        conversationId: persisted.conversationId,
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

    // Channel media download — no pet sessionId; worker stores under whatsapp-media/
    if (MEDIA_KINDS.has(event.kind) && event.mediaUrl) {
      await store.enqueueJob({
        type: "download_media",
        messageId: persisted.messageId,
        orgId: line.orgId,
        mediaUrl: event.mediaUrl,
        kind: "animal",
      });
    }
  }

  return {
    httpStatus: 200,
    body: {
      ok: true,
      duplicate: persisted.status === "duplicate",
      messageId: persisted.messageId,
      conversationId: persisted.conversationId,
    },
  };
}

// ingestDeliveryAck - update outbound delivery_status after secret check
export async function ingestDeliveryAck(
  store: InboundStore,
  ack: DeliveryAck,
  providedSecret?: string | null,
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const resolved = await resolveLineOrSecretError(store, ack.instance);
  if (!resolved.ok) return { httpStatus: resolved.httpStatus, body: resolved.body };
  const line = resolved.line;
  const secretCheck = verifyWebhookSecret(line.webhookSecret, providedSecret);
  if (!secretCheck.ok) {
    return {
      httpStatus: secretCheck.status,
      body: { ok: false, code: secretCheck.code },
    };
  }
  const result = await store.applyDeliveryAck({ line, ack });
  return {
    httpStatus: 200,
    body: { ok: true, updated: result.updated, deliveryStatus: ack.deliveryStatus },
  };
}
