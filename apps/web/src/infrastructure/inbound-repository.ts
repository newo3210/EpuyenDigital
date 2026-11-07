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
  /** Reopen resolved conversations on citizen inbound (INB-07). */
  reopenIfResolved?(conversationId: string): Promise<void>;
  /**
   * Pet process_inbound gate — see decideShouldEnqueuePetProcessInbound.
   */
  shouldEnqueuePetProcessInbound?(params: {
    orgId: string;
    lineId: string;
    phoneNormalized: string;
    conversationId: string;
    evolutionInstance: string;
  }): Promise<boolean>;
};

/**
 * Pet enqueue rule for shared Mesa/Inspectoría line coexistence.
 * True when: open registration session, Evolution instance/line name looks like
 * Inspectoría, or conversation area is Inspectoría. False only for clearly
 * Mesa-only lines (non-inspectoria instance) with Mesa area and no session.
 */
export function decideShouldEnqueuePetProcessInbound(params: {
  evolutionInstance: string;
  lineName?: string | null;
  areaName?: string | null;
  hasOpenSession: boolean;
}): boolean {
  if (params.hasOpenSession) return true;
  const instance = params.evolutionInstance.toLowerCase();
  if (instance.includes("inspector")) return true;
  const lineName = String(params.lineName ?? "").toLowerCase();
  if (lineName.includes("inspector")) return true;
  const areaName = String(params.areaName ?? "").toLowerCase();
  if (areaName.includes("inspector")) return true;
  return false;
}

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
    {
      id: string;
      orgId: string;
      lineId: string;
      phone: string;
      areaId: string;
      citizenId?: string;
      queueColumn?: string;
      areaName?: string;
    }
  >();
  citizens = new Map<
    string,
    { id: string; orgId: string; phone: string; pushName?: string; avatarUrl?: string }
  >();
  registrationSessions = new Set<string>();
  jobs: JobPayload[] = [];
  reopenCalls: string[] = [];

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
        queueColumn: "new",
        areaName: "Mesa de Entrada",
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

  async reopenIfResolved(conversationId: string): Promise<void> {
    this.reopenCalls.push(conversationId);
    for (const conversation of this.conversations.values()) {
      if (conversation.id === conversationId && conversation.queueColumn === "resolved") {
        conversation.queueColumn = "new";
      }
    }
  }

  async shouldEnqueuePetProcessInbound(params: {
    orgId: string;
    lineId: string;
    phoneNormalized: string;
    conversationId: string;
    evolutionInstance: string;
  }): Promise<boolean> {
    let areaName: string | null = null;
    for (const conversation of this.conversations.values()) {
      if (conversation.id === params.conversationId) {
        areaName = conversation.areaName ?? null;
        break;
      }
    }
    const sessionKey = `${params.lineId}:${params.phoneNormalized}`;
    return decideShouldEnqueuePetProcessInbound({
      evolutionInstance: params.evolutionInstance,
      areaName,
      hasOpenSession: this.registrationSessions.has(sessionKey),
    });
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
    // Citizen inbound on a resolved thread re-enters the triage queue.
    if (!event.fromMe && store.reopenIfResolved) {
      await store.reopenIfResolved(persisted.conversationId);
    }

    const enqueuePet =
      !store.shouldEnqueuePetProcessInbound ||
      (await store.shouldEnqueuePetProcessInbound({
        orgId: line.orgId,
        lineId: line.lineId,
        phoneNormalized: event.phoneNormalized,
        conversationId: persisted.conversationId,
        evolutionInstance: line.instance,
      }));

    if (enqueuePet) {
      await store.enqueueJob({
        type: "process_inbound",
        messageId: persisted.messageId,
        lineId: line.lineId,
        orgId: line.orgId,
      });
    }

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
