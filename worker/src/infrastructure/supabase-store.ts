import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  jobPayloadSchema,
  type JobPayload,
  type RegistrationStep,
  type SessionPayload,
} from "@epuyen/shared";
import type {
  CitizenRow,
  MessageRow,
  OrgSettingsRow,
  SessionRow,
  WorkerStore,
} from "./store.js";

// SupabaseWorkerStore - Postgres-backed claim (RPC/SQL) and repositories

export function createSupabaseWorkerStore(
  url: string,
  serviceRoleKey: string,
): WorkerStore {
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return new SupabaseWorkerStore(client);
}

class SupabaseWorkerStore implements WorkerStore {
  constructor(private readonly client: SupabaseClient) {}

  async claimNextJob() {
    // Prefer SKIP LOCKED via raw SQL RPC when available; fallback select+update
    const { data, error } = await this.client.rpc("claim_next_job");
    if (!error && data?.[0]) {
      const row = data[0] as {
        id: string;
        payload: unknown;
        attempts: number;
        max_attempts: number;
      };
      return {
        id: row.id,
        payload: jobPayloadSchema.parse(row.payload),
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
      };
    }

    const { data: rows } = await this.client
      .from("jobs")
      .select("id, payload, attempts, max_attempts")
      .eq("status", "pending")
      .lte("available_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1);
    const row = rows?.[0];
    if (!row) return null;
    const { data: claimed } = await this.client
      .from("jobs")
      .update({
        status: "processing",
        attempts: (row.attempts as number) + 1,
        locked_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id, payload, attempts, max_attempts")
      .maybeSingle();
    if (!claimed) return null;
    return {
      id: claimed.id as string,
      payload: jobPayloadSchema.parse(claimed.payload),
      attempts: claimed.attempts as number,
      maxAttempts: claimed.max_attempts as number,
    };
  }

  async markJobDone(id: string) {
    await this.client.from("jobs").update({ status: "done", error: null }).eq("id", id);
  }

  async markJobFailed(id: string, error: string, retry: boolean) {
    await this.client
      .from("jobs")
      .update({
        status: retry ? "pending" : "failed",
        error,
        available_at: new Date(Date.now() + 5_000).toISOString(),
      })
      .eq("id", id);
  }

  async getMessage(id: string): Promise<MessageRow | null> {
    const { data } = await this.client.from("messages").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      orgId: data.org_id,
      lineId: data.line_id,
      phoneNormalized: data.phone_normalized,
      kind: data.kind,
      body: data.body,
      mediaUrl: data.media_url,
      mediaMime: data.media_mime,
      latitude: data.latitude == null ? null : Number(data.latitude),
      longitude: data.longitude == null ? null : Number(data.longitude),
      storagePath: data.storage_path,
    };
  }

  async getOrgSettings(orgId: string): Promise<OrgSettingsRow> {
    const { data } = await this.client
      .from("org_settings")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    return {
      sendMode: (data?.send_mode as OrgSettingsRow["sendMode"]) ?? "dry_run",
      allowlistPhones: (data?.allowlist_phones as string[]) ?? [],
      ttlHours: (data?.registration_session_ttl_hours as number) ?? 24,
      privacyNoticeVersion: (data?.privacy_notice_version as string) ?? "v1",
    };
  }

  async findCitizenByPhone(orgId: string, phone: string): Promise<CitizenRow | null> {
    const { data: phoneRow } = await this.client
      .from("citizen_phones")
      .select("citizen_id")
      .eq("org_id", orgId)
      .eq("phone_normalized", phone)
      .maybeSingle();
    if (!phoneRow) return null;
    const { data } = await this.client
      .from("citizens")
      .select("*")
      .eq("id", phoneRow.citizen_id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      fullName: data.full_name,
      documentId: data.document_id,
      addressLine: data.address_line,
      neighborhood: data.neighborhood,
      latitude: data.latitude == null ? null : Number(data.latitude),
      longitude: data.longitude == null ? null : Number(data.longitude),
    };
  }

  async lockSession(lineId: string, phone: string): Promise<SessionRow | null> {
    const { data } = await this.client
      .from("registration_sessions")
      .select("*")
      .eq("line_id", lineId)
      .eq("phone_normalized", phone)
      .maybeSingle();
    if (!data) return null;
    return mapSession(data);
  }

  async upsertSession(session: SessionRow): Promise<SessionRow> {
    const { data, error } = await this.client
      .from("registration_sessions")
      .upsert(
        {
          id: session.id,
          org_id: session.orgId,
          line_id: session.lineId,
          phone_normalized: session.phoneNormalized,
          step: session.step,
          payload: session.payload,
          expires_at: session.expiresAt.toISOString(),
        },
        { onConflict: "line_id,phone_normalized" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return mapSession(data);
  }

  async upsertCitizenFromPayload(params: {
    orgId: string;
    phone: string;
    payload: SessionPayload;
  }): Promise<CitizenRow> {
    const existing = await this.findCitizenByPhone(params.orgId, params.phone);
    if (existing) {
      await this.client
        .from("citizens")
        .update({
          full_name: params.payload.fullName,
          document_id: params.payload.documentId,
          address_line: params.payload.addressLine,
          neighborhood: params.payload.neighborhood,
          latitude: params.payload.latitude,
          longitude: params.payload.longitude,
          privacy_consent_at: params.payload.privacyConsentAt,
          privacy_notice_version: params.payload.privacyNoticeVersion,
        })
        .eq("id", existing.id);
      return (await this.findCitizenByPhone(params.orgId, params.phone))!;
    }

    const { data, error } = await this.client
      .from("citizens")
      .insert({
        org_id: params.orgId,
        full_name: params.payload.fullName,
        document_id: params.payload.documentId,
        address_line: params.payload.addressLine,
        neighborhood: params.payload.neighborhood,
        latitude: params.payload.latitude,
        longitude: params.payload.longitude,
        privacy_consent_at: params.payload.privacyConsentAt,
        privacy_notice_version: params.payload.privacyNoticeVersion,
      })
      .select("*")
      .single();
    if (error) throw error;
    await this.client.from("citizen_phones").insert({
      org_id: params.orgId,
      citizen_id: data.id,
      phone_normalized: params.phone,
    });
    return {
      id: data.id,
      fullName: data.full_name,
      documentId: data.document_id,
      addressLine: data.address_line,
      neighborhood: data.neighborhood,
      latitude: data.latitude == null ? null : Number(data.latitude),
      longitude: data.longitude == null ? null : Number(data.longitude),
    };
  }

  async completeAnimalRegistration(params: {
    orgId: string;
    citizenId: string;
    payload: SessionPayload;
  }) {
    const { data, error } = await this.client.rpc("complete_animal_registration", {
      p_org_id: params.orgId,
      p_citizen_id: params.citizenId,
      p_name: params.payload.animalName,
      p_species: params.payload.species,
      p_sex: params.payload.sex,
      p_breed_color: params.payload.breedColor,
      p_size: params.payload.size,
      p_age_stage: params.payload.ageStage,
      p_sterilized: params.payload.sterilized,
      p_rabies_status: params.payload.rabiesStatus,
      p_microchip: params.payload.microchip ?? null,
      p_latitude: params.payload.latitude ?? null,
      p_longitude: params.payload.longitude ?? null,
      p_neighborhood: params.payload.neighborhood ?? null,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { animalId: row.animal_id as string, municipalId: row.municipal_id as string };
  }

  async enqueueJob(orgId: string | null, payload: JobPayload) {
    const { error } = await this.client.from("jobs").insert({
      org_id: orgId,
      job_type: payload.type,
      payload,
      status: "pending",
    });
    if (error) throw error;
  }

  async persistOutbound(params: {
    orgId: string;
    lineId: string;
    phone: string;
    text: string;
    deliveryStatus: "sent" | "blocked" | "simulated";
    externalId?: string;
  }) {
    await this.client.from("messages").insert({
      org_id: params.orgId,
      line_id: params.lineId,
      external_id: params.externalId ?? `local-out-${Date.now()}-${Math.random()}`,
      direction: "outbound",
      phone_normalized: params.phone,
      kind: "text",
      body: params.text,
      delivery_status: params.deliveryStatus,
    });
  }

  async getLineInstance(lineId: string) {
    const { data } = await this.client
      .from("whatsapp_lines")
      .select("evolution_instance, org_id")
      .eq("id", lineId)
      .maybeSingle();
    if (!data) return null;
    return { instance: data.evolution_instance as string, orgId: data.org_id as string };
  }

  async saveMedia(params: {
    orgId: string;
    path: string;
    bytes: Uint8Array;
    mime: string;
  }) {
    const { error } = await this.client.storage
      .from("animal-media")
      .upload(params.path, params.bytes, { contentType: params.mime, upsert: true });
    if (error) throw error;
    return params.path;
  }

  async linkAnimalPhoto(params: {
    orgId: string;
    animalId: string;
    kind: "animal" | "health_card";
    storagePath: string;
    messageId?: string;
  }) {
    await this.client.from("animal_photos").insert({
      org_id: params.orgId,
      animal_id: params.animalId,
      kind: params.kind,
      storage_path: params.storagePath,
      message_id: params.messageId ?? null,
    });
  }

  async updateMessageStorage(messageId: string, storagePath: string) {
    await this.client
      .from("messages")
      .update({ storage_path: storagePath })
      .eq("id", messageId);
  }

  async listAnimalPhotoPaths(animalId: string) {
    const { data } = await this.client
      .from("animal_photos")
      .select("storage_path")
      .eq("animal_id", animalId)
      .eq("kind", "animal");
    return (data ?? []).map((r) => ({ path: r.storage_path as string }));
  }

  async readStorage(path: string) {
    const { data, error } = await this.client.storage.from("animal-media").download(path);
    if (error || !data) throw error ?? new Error("STORAGE_NOT_FOUND");
    const bytes = new Uint8Array(await data.arrayBuffer());
    return { bytes, mime: data.type || "application/octet-stream" };
  }

  async updateAnimalTraits(params: {
    animalId: string;
    traits: unknown;
    status: "ready" | "pending_manual";
  }) {
    await this.client
      .from("animals")
      .update({
        distinctive_traits: params.traits,
        traits_status: params.status,
      })
      .eq("id", params.animalId);
  }

  async getPendingAnimalIdForSession() {
    return null;
  }
}

function mapSession(data: Record<string, unknown>): SessionRow {
  return {
    id: data.id as string,
    orgId: data.org_id as string,
    lineId: data.line_id as string,
    phoneNormalized: data.phone_normalized as string,
    step: data.step as RegistrationStep,
    payload: (data.payload ?? {}) as SessionPayload,
    expiresAt: new Date(data.expires_at as string),
  };
}
