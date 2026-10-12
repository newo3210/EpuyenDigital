import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EvolutionWebhook, JobPayload } from "@epuyen/shared";
import type { InboundStore, LineContext, PersistResult } from "./inbound-repository";

// Supabase inbound store - service-role persist + job enqueue

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

export class SupabaseInboundStore implements InboundStore {
  constructor(private readonly client: SupabaseClient) {}

  async findLineByInstance(instance: string): Promise<LineContext | null> {
    const { data: line, error } = await this.client
      .from("whatsapp_lines")
      .select("id, org_id, evolution_instance")
      .eq("evolution_instance", instance)
      .maybeSingle();
    if (error || !line) return null;

    const { data: secret } = await this.client
      .from("whatsapp_line_secrets")
      .select("webhook_secret")
      .eq("line_id", line.id)
      .maybeSingle();

    return {
      lineId: line.id as string,
      orgId: line.org_id as string,
      instance: line.evolution_instance as string,
      webhookSecret: (secret?.webhook_secret as string | null) ?? null,
    };
  }

  async persistInbound(params: {
    line: LineContext;
    event: EvolutionWebhook;
  }): Promise<PersistResult> {
    const row = {
      org_id: params.line.orgId,
      line_id: params.line.lineId,
      external_id: params.event.externalId,
      // fromMe is phone-side outbound echo; never drives process_inbound
      direction: params.event.fromMe ? "outbound" : "inbound",
      phone_normalized: params.event.phoneNormalized,
      kind: params.event.kind,
      body: params.event.text ?? null,
      media_url: params.event.mediaUrl ?? null,
      media_mime: params.event.mediaMime ?? null,
      latitude: params.event.latitude ?? null,
      longitude: params.event.longitude ?? null,
      raw: params.event,
    };

    const { data, error } = await this.client
      .from("messages")
      .upsert(row, { onConflict: "line_id,external_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();

    if (error) {
      const { data: existing } = await this.client
        .from("messages")
        .select("id")
        .eq("line_id", params.line.lineId)
        .eq("external_id", params.event.externalId)
        .maybeSingle();
      if (existing?.id) {
        return { status: "duplicate", messageId: existing.id as string };
      }
      throw error;
    }

    if (!data?.id) {
      const { data: existing } = await this.client
        .from("messages")
        .select("id")
        .eq("line_id", params.line.lineId)
        .eq("external_id", params.event.externalId)
        .maybeSingle();
      if (!existing?.id) {
        throw new Error("MESSAGE_UPSERT_FAILED");
      }
      return { status: "duplicate", messageId: existing.id as string };
    }

    return { status: "inserted", messageId: data.id as string };
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
}
