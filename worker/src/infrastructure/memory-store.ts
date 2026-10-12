import {
  citizenUpsertSchema,
  formatMunicipalId,
  registrationYearBuenosAires,
  type JobPayload,
  type RegistrationStep,
  type SessionPayload,
} from "@epuyen/shared";
import type {
  CitizenRow,
  CompleteAnimalResult,
  MessageRow,
  OrgSettingsRow,
  SessionRow,
  WorkerStore,
} from "./store.js";

// MemoryWorkerStore - in-memory fake for handler and flow tests

type JobInternal = {
  id: string;
  orgId: string | null;
  payload: JobPayload;
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  maxAttempts: number;
  error?: string;
};

export class MemoryWorkerStore implements WorkerStore {
  jobs: JobInternal[] = [];
  messages = new Map<string, MessageRow>();
  sessions = new Map<string, SessionRow>();
  citizens: CitizenRow[] = [];
  phones = new Map<string, string>(); // phone -> citizenId
  animals: Array<{
    id: string;
    orgId: string;
    citizenId: string;
    name: string;
    municipalId: string;
    status: string;
    traitsStatus: string;
    distinctiveTraits: unknown;
    species: string;
    latitude: number | null;
    longitude: number | null;
  }> = [];
  photos: Array<{
    animalId: string;
    kind: string;
    storagePath: string;
    orgId: string;
  }> = [];
  outbounds: Array<{
    phone: string;
    text: string;
    deliveryStatus: string;
  }> = [];
  storage = new Map<string, { bytes: Uint8Array; mime: string }>();
  counters = new Map<string, number>();
  neighborhoodCodes = new Map<string, string>([
    ["centro", "CENT"],
    ["epuyen", "EPU"],
  ]);
  settings: OrgSettingsRow = {
    sendMode: "dry_run",
    allowlistPhones: ["5492944216586"],
    ttlHours: 24,
    privacyNoticeVersion: "v1",
  };
  line = {
    id: "00000000-0000-4000-8000-000000000002",
    orgId: "00000000-0000-4000-8000-000000000001",
    instance: "inspectoria",
  };

  /** Per-phone async mutex chain for concurrent process_inbound */
  private lockChains = new Map<string, Promise<unknown>>();

  async claimNextJob() {
    const job = this.jobs.find((j) => j.status === "pending");
    if (!job) return null;
    job.status = "processing";
    job.attempts += 1;
    return {
      id: job.id,
      payload: job.payload,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    };
  }

  async markJobDone(id: string) {
    const job = this.jobs.find((j) => j.id === id);
    if (job) job.status = "done";
  }

  async markJobFailed(id: string, error: string, retry: boolean) {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return;
    job.error = error;
    job.status = retry && job.attempts < job.maxAttempts ? "pending" : "failed";
  }

  async getMessage(id: string) {
    return this.messages.get(id) ?? null;
  }

  async getOrgSettings() {
    return this.settings;
  }

  async findCitizenByPhone(_orgId: string, phone: string) {
    const id = this.phones.get(phone);
    if (!id) return null;
    return this.citizens.find((c) => c.id === id) ?? null;
  }

  async lockSession(lineId: string, phone: string) {
    return this.sessions.get(`${lineId}:${phone}`) ?? null;
  }

  async runWithSessionLock<T>(
    lineId: string,
    phone: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = `${lineId}:${phone}`;
    const prev = this.lockChains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.lockChains.set(
      key,
      prev.then(() => gate).catch(() => gate),
    );
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async upsertSession(session: SessionRow) {
    this.sessions.set(`${session.lineId}:${session.phoneNormalized}`, session);
    return session;
  }

  async upsertCitizenFromPayload(params: {
    orgId: string;
    phone: string;
    payload: SessionPayload;
  }): Promise<CitizenRow> {
    const existingId = this.phones.get(params.phone);
    const existing = existingId
      ? this.citizens.find((x) => x.id === existingId) ?? null
      : null;
    const parsed = citizenUpsertSchema.parse({
      fullName: params.payload.fullName ?? existing?.fullName,
      documentId: params.payload.documentId ?? existing?.documentId,
      addressLine: params.payload.addressLine ?? existing?.addressLine,
      neighborhood: params.payload.neighborhood ?? existing?.neighborhood,
      latitude: params.payload.latitude ?? existing?.latitude,
      longitude: params.payload.longitude ?? existing?.longitude,
      privacyConsentAt:
        params.payload.privacyConsentAt ?? existing?.privacyConsentAt,
      phoneNormalized: params.phone,
    });

    if (existing) {
      existing.fullName = parsed.fullName;
      existing.documentId = parsed.documentId;
      existing.addressLine = parsed.addressLine;
      existing.neighborhood = parsed.neighborhood;
      existing.latitude = parsed.latitude;
      existing.longitude = parsed.longitude;
      existing.privacyConsentAt = parsed.privacyConsentAt;
      existing.privacyNoticeVersion =
        params.payload.privacyNoticeVersion ?? existing.privacyNoticeVersion;
      return existing;
    }
    const citizen: CitizenRow = {
      id: crypto.randomUUID(),
      fullName: parsed.fullName,
      documentId: parsed.documentId,
      addressLine: parsed.addressLine,
      neighborhood: parsed.neighborhood,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      privacyConsentAt: parsed.privacyConsentAt,
      privacyNoticeVersion: params.payload.privacyNoticeVersion ?? "v1",
    };
    this.citizens.push(citizen);
    this.phones.set(params.phone, citizen.id);
    return citizen;
  }

  async completeAnimalRegistration(params: {
    orgId: string;
    citizenId: string;
    payload: SessionPayload;
  }): Promise<CompleteAnimalResult> {
    if (params.payload.completedAnimalId && params.payload.completedMunicipalId) {
      return {
        animalId: params.payload.completedAnimalId,
        municipalId: params.payload.completedMunicipalId,
      };
    }
    const year = registrationYearBuenosAires();
    const key = `${params.orgId}:${year}`;
    const seq = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, seq);
    const neighborhood = (params.payload.neighborhood ?? "").toLowerCase().trim();
    const code = this.neighborhoodCodes.get(neighborhood) ?? null;
    const municipalId = formatMunicipalId({
      barrioCode: code,
      year,
      sequence: seq,
    });
    const animalId = crypto.randomUUID();
    this.animals.push({
      id: animalId,
      orgId: params.orgId,
      citizenId: params.citizenId,
      name: params.payload.animalName ?? "?",
      municipalId,
      status: "active",
      traitsStatus: "pending",
      distinctiveTraits: null,
      species: params.payload.species ?? "other",
      latitude: params.payload.latitude ?? null,
      longitude: params.payload.longitude ?? null,
    });
    return { animalId, municipalId };
  }

  async markSessionCompleted(params: {
    sessionId: string;
    animalId: string;
    municipalId: string;
    payload: SessionPayload;
  }) {
    const session = [...this.sessions.values()].find((s) => s.id === params.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.payload.completedAnimalId) {
      return {
        animalId: session.payload.completedAnimalId,
        municipalId: session.payload.completedMunicipalId ?? params.municipalId,
        alreadyDone: true,
      };
    }
    session.step = "done";
    session.payload = {
      ...params.payload,
      completedAnimalId: params.animalId,
      completedMunicipalId: params.municipalId,
    };
    this.sessions.set(`${session.lineId}:${session.phoneNormalized}`, session);
    return {
      animalId: params.animalId,
      municipalId: params.municipalId,
      alreadyDone: false,
    };
  }

  async enqueueJob(orgId: string | null, payload: JobPayload) {
    this.jobs.push({
      id: crypto.randomUUID(),
      orgId,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
    });
  }

  async persistOutbound(params: {
    orgId: string;
    lineId: string;
    phone: string;
    text: string;
    deliveryStatus: "sent" | "blocked" | "simulated";
    externalId?: string;
  }) {
    this.outbounds.push({
      phone: params.phone,
      text: params.text,
      deliveryStatus: params.deliveryStatus,
    });
  }

  async getLineInstance(lineId: string) {
    if (lineId !== this.line.id) return null;
    return { instance: this.line.instance, orgId: this.line.orgId };
  }

  async saveMedia(params: {
    orgId: string;
    path: string;
    bytes: Uint8Array;
    mime: string;
  }) {
    this.storage.set(params.path, { bytes: params.bytes, mime: params.mime });
    return params.path;
  }

  async linkAnimalPhoto(params: {
    orgId: string;
    animalId: string;
    kind: "animal" | "health_card";
    storagePath: string;
    messageId?: string;
  }) {
    this.photos.push({
      animalId: params.animalId,
      kind: params.kind,
      storagePath: params.storagePath,
      orgId: params.orgId,
    });
  }

  async updateMessageStorage(messageId: string, storagePath: string) {
    const msg = this.messages.get(messageId);
    if (msg) msg.storagePath = storagePath;
  }

  async listAnimalPhotoPaths(animalId: string) {
    return this.photos
      .filter((p) => p.animalId === animalId && p.kind === "animal")
      .map((p) => {
        const file = this.storage.get(p.storagePath);
        return { path: p.storagePath, mime: file?.mime };
      });
  }

  async readStorage(path: string) {
    const hit = this.storage.get(path);
    if (!hit) throw new Error("STORAGE_NOT_FOUND");
    return hit;
  }

  async updateAnimalTraits(params: {
    animalId: string;
    traits: unknown;
    status: "ready" | "pending_manual";
  }) {
    const animal = this.animals.find((a) => a.id === params.animalId);
    if (!animal) return;
    animal.distinctiveTraits = params.traits;
    animal.traitsStatus = params.status;
  }

  async getPendingAnimalIdForSession(sessionId: string) {
    const session = [...this.sessions.values()].find((s) => s.id === sessionId);
    return session?.payload.completedAnimalId ?? null;
  }

  // helpers for tests
  seedMessage(row: MessageRow) {
    this.messages.set(row.id, row);
  }

  seedSession(partial: {
    phone: string;
    step: RegistrationStep;
    payload?: SessionPayload;
    expiresAt?: Date;
  }) {
    const session: SessionRow = {
      id: crypto.randomUUID(),
      orgId: this.line.orgId,
      lineId: this.line.id,
      phoneNormalized: partial.phone,
      step: partial.step,
      payload: partial.payload ?? {},
      expiresAt: partial.expiresAt ?? new Date(Date.now() + 86_400_000),
    };
    this.sessions.set(`${session.lineId}:${session.phoneNormalized}`, session);
    return session;
  }
}
