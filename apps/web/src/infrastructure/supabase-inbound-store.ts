import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  decryptSecret,
  looksLikeCiphertext,
  shouldReopenConversation,
  type DeliveryAck,
  type EvolutionWebhook,
  type JobPayload,
} from "@epuyen/shared";
import type { InboundStore, LineContext, PersistResult } from "./inbound-repository";

// Supabase inbound store - service-role persist, conversation upsert, job enqueue

let cached: InboundStore | null = null;

export function getSupabaseInboundStore(): InboundStore {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  cached = new SupabaseInboundStore(client);
  return cached;
}

function resolveWebhookSecret(row: {
  webhook_secret?: string | null;
  webhook_secret_ciphertext?: string | null;
}): string | null {
  const cipher = row.webhook_secret_ciphertext;
  if (cipher && looksLikeCiphertext(cipher)) {
    const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (!key) {
      throw new Error("CREDENTIALS_ENCRYPTION_KEY_MISSING");
    }
    try {
      return decryptSecret(cipher, key);
    } catch {
      // Fail closed — ciphertext present but key missing/wrong must not open the webhook
      throw new Error("CREDENTIALS_ENCRYPTION_KEY_MISSING");
    }
  }
  // Legacy plaintext column (local seed / pre-migration rows)
  return row.webhook_secret ?? null;
}

const ACK_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  simulated: 0,
  blocked: 0,
  failed: 0,
};

export class SupabaseInboundStore implements InboundStore {
  constructor(private readonly client: SupabaseClient) {}

  async findLineByInstance(instance: string): Promise<LineContext | null> {
    const { data: line, error } = await this.client
      .from("whatsapp_lines")
      .select("id, org_id, evolution_instance, default_area_id")
      .eq("evolution_instance", instance)
      .maybeSingle();
    if (error || !line) return null;

    const { data: secret } = await this.client
      .from("whatsapp_line_secrets")
      .select("webhook_secret, webhook_secret_ciphertext")
      .eq("line_id", line.id)
      .maybeSingle();

    return {
      lineId: line.id as string,
      orgId: line.org_id as string,
      instance: line.evolution_instance as string,
      defaultAreaId: (line.default_area_id as string | null) ?? null,
      webhookSecret: secret ? resolveWebhookSecret(secret) : null,
    };
  }

  async persistInbound(params: {
    line: LineContext;
    event: EvolutionWebhook;
  }): Promise<PersistResult> {
    const conversationId = await this.upsertConversation(params.line, params.event);
    const direction = params.event.fromMe ? "outbound" : "inbound";
    const senderKind = params.event.fromMe ? "phone" : "citizen";

    const row = {
      org_id: params.line.orgId,
      line_id: params.line.lineId,
      conversation_id: conversationId,
      external_id: params.event.externalId,
      // fromMe is phone-side outbound echo; never drives process_inbound
      direction,
      sender_kind: senderKind,
      phone_normalized: params.event.phoneNormalized,
      kind: params.event.kind,
      body: params.event.text ?? null,
      media_url: params.event.mediaUrl ?? null,
      media_mime: params.event.mediaMime ?? null,
      // Location stays on the message — never written to citizens.lat/lng here
      latitude: params.event.latitude ?? null,
      longitude: params.event.longitude ?? null,
      delivery_status: params.event.fromMe ? "sent" : null,
      raw: params.event,
    };

    const { data, error } = await this.client
      .from("messages")
      .upsert(row, { onConflict: "line_id,external_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();

    if (error) {
      const existing = await this.findMessageId(params.line.lineId, params.event.externalId);
      if (existing) {
        await this.maybeReopen(conversationId, existing, params.event.fromMe);
        return { status: "duplicate", messageId: existing, conversationId };
      }
      throw error;
    }

    if (!data?.id) {
      const existing = await this.findMessageId(params.line.lineId, params.event.externalId);
      if (!existing) {
        throw new Error("MESSAGE_UPSERT_FAILED");
      }
      await this.maybeReopen(conversationId, existing, params.event.fromMe);
      return { status: "duplicate", messageId: existing, conversationId };
    }

    await this.maybeReopen(conversationId, data.id as string, params.event.fromMe);
    await this.touchConversationTimestamps(conversationId, direction, params.event);
    return { status: "inserted", messageId: data.id as string, conversationId };
  }

  async applyDeliveryAck(params: {
    line: LineContext;
    ack: DeliveryAck;
  }): Promise<{ updated: boolean }> {
    const { data: existing, error: readError } = await this.client
      .from("messages")
      .select("id, delivery_status")
      .eq("line_id", params.line.lineId)
      .eq("external_id", params.ack.externalId)
      .eq("direction", "outbound")
      .maybeSingle();
    if (readError) throw readError;
    if (!existing?.id) return { updated: false };

    const currentRank = ACK_RANK[String(existing.delivery_status ?? "")] ?? -1;
    const nextRank = ACK_RANK[params.ack.deliveryStatus] ?? -1;
    // Monotonic upgrade only — late "sent" must not overwrite delivered/read
    if (nextRank < currentRank) {
      return { updated: false };
    }

    const patch: Record<string, unknown> = {
      delivery_status: params.ack.deliveryStatus,
    };
    if (params.ack.deliveryStatus === "delivered") {
      patch.delivered_at = new Date().toISOString();
    }
    if (params.ack.deliveryStatus === "read") {
      patch.read_at = new Date().toISOString();
      patch.delivered_at = new Date().toISOString();
    }

    const { data, error } = await this.client
      .from("messages")
      .update(patch)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return { updated: Boolean(data?.id) };
  }

  async enqueueJob(payload: JobPayload): Promise<void> {
    const { error } = await this.client.from("jobs").insert({
      org_id:
        payload.type === "send_outbound"
          ? null
          : "orgId" in payload
            ? payload.orgId
            : null,
      job_type: payload.type,
      payload,
      status: "pending",
    });
    if (error) throw error;
  }

  private async findMessageId(lineId: string, externalId: string): Promise<string | null> {
    const { data } = await this.client
      .from("messages")
      .select("id")
      .eq("line_id", lineId)
      .eq("external_id", externalId)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }

  private async resolveDefaultAreaId(line: LineContext): Promise<string> {
    if (line.defaultAreaId) return line.defaultAreaId;
    const { data: defaultArea } = await this.client
      .from("areas")
      .select("id")
      .eq("org_id", line.orgId)
      .eq("is_default", true)
      .maybeSingle();
    if (defaultArea?.id) return defaultArea.id as string;
    const { data: anyArea } = await this.client
      .from("areas")
      .select("id")
      .eq("org_id", line.orgId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!anyArea?.id) throw new Error("ORG_HAS_NO_AREA");
    return anyArea.id as string;
  }

  private async upsertCitizenStub(
    line: LineContext,
    event: EvolutionWebhook,
  ): Promise<string> {
    const { data: existingPhone } = await this.client
      .from("citizen_phones")
      .select("citizen_id")
      .eq("org_id", line.orgId)
      .eq("phone_normalized", event.phoneNormalized)
      .maybeSingle();

    if (existingPhone?.citizen_id) {
      const citizenId = existingPhone.citizen_id as string;
      if (event.pushName || event.avatarUrl) {
        const patch: Record<string, unknown> = {};
        if (event.pushName) patch.whatsapp_push_name = event.pushName;
        if (event.avatarUrl) {
          patch.whatsapp_avatar_url = event.avatarUrl;
          patch.whatsapp_avatar_fetched_at = new Date().toISOString();
        }
        // Never overwrite citizens.latitude/longitude from inbound location
        await this.client.from("citizens").update(patch).eq("id", citizenId);
      }
      return citizenId;
    }

    const { data: citizen, error: citizenError } = await this.client
      .from("citizens")
      .insert({
        org_id: line.orgId,
        registration_status: "unregistered",
        party_kind: "person",
        whatsapp_push_name: event.pushName ?? null,
        whatsapp_avatar_url: event.avatarUrl ?? null,
        whatsapp_avatar_fetched_at: event.avatarUrl ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (citizenError || !citizen?.id) throw citizenError ?? new Error("CITIZEN_INSERT_FAILED");

    const { error: phoneError } = await this.client.from("citizen_phones").insert({
      org_id: line.orgId,
      citizen_id: citizen.id,
      phone_normalized: event.phoneNormalized,
    });
    if (phoneError) {
      // Race on unique (org_id, phone_normalized) — re-select winner like conversations
      if (phoneError.code === "23505") {
        const { data: raced } = await this.client
          .from("citizen_phones")
          .select("citizen_id")
          .eq("org_id", line.orgId)
          .eq("phone_normalized", event.phoneNormalized)
          .maybeSingle();
        if (raced?.citizen_id) return raced.citizen_id as string;
      }
      throw phoneError;
    }
    return citizen.id as string;
  }

  private async upsertConversation(
    line: LineContext,
    event: EvolutionWebhook,
  ): Promise<string> {
    const areaId = await this.resolveDefaultAreaId(line);
    const citizenId = await this.upsertCitizenStub(line, event);

    const { data: existing } = await this.client
      .from("conversations")
      .select("id")
      .eq("org_id", line.orgId)
      .eq("line_id", line.lineId)
      .eq("phone_normalized", event.phoneNormalized)
      .maybeSingle();

    if (existing?.id) {
      await this.client
        .from("conversations")
        .update({ citizen_id: citizenId })
        .eq("id", existing.id)
        .is("citizen_id", null);
      return existing.id as string;
    }

    const { data: created, error } = await this.client
      .from("conversations")
      .insert({
        org_id: line.orgId,
        line_id: line.lineId,
        phone_normalized: event.phoneNormalized,
        citizen_id: citizenId,
        area_id: areaId,
        bot_state: "active",
        queue_column: "new",
        entered_queue_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      // Race: unique conflict — re-read
      const { data: raced } = await this.client
        .from("conversations")
        .select("id")
        .eq("org_id", line.orgId)
        .eq("line_id", line.lineId)
        .eq("phone_normalized", event.phoneNormalized)
        .maybeSingle();
      if (raced?.id) return raced.id as string;
      throw error;
    }
    return created.id as string;
  }

  private async maybeReopen(conversationId: string, messageId: string, fromMe: boolean): Promise<void> {
    if (fromMe) return;
    const { data, error } = await this.client
      .from("conversations")
      .select("queue_column")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw error;
    if (!shouldReopenConversation({ fromMe, queueColumn: data?.queue_column })) return;
    const { error: reopenError } = await this.client.rpc("reopen_conversation", {
      p_conversation_id: conversationId,
      p_at: new Date().toISOString(),
      p_message_id: messageId,
    });
    if (reopenError) throw reopenError;
  }

  private async touchConversationTimestamps(
    conversationId: string,
    direction: "inbound" | "outbound",
    event: EvolutionWebhook,
  ): Promise<void> {
    const now = new Date().toISOString();
    const preview = (event.text ?? event.kind).slice(0, 140);
    const patch: Record<string, unknown> = {
      last_message_at: now,
      last_message_preview: preview,
      last_message_kind: event.kind,
      needs_response: direction === "inbound",
    };
    if (direction === "inbound") patch.last_inbound_at = now;
    if (direction === "outbound") patch.last_outbound_at = now;
    if (["image", "audio", "video", "document", "sticker"].includes(event.kind)) {
      patch.has_attachments = true;
    }
    await this.client.from("conversations").update(patch).eq("id", conversationId);
  }
}
