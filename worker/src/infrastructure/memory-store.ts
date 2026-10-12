import {
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
    if (existingId) {
      const c = this.citizens.find((x) => x.id === existingId)!;
      c.fullName = params.payload.fullName ?? c.fullName;
      c.documentId = params.payload.documentId ?? c.documentId;
      c.addressLine = params.payload.addressLine ?? c.addressLine;
      c.neighborhood = params.payload.neighborhood ?? c.neighborhood;
      c.latitude = params.payload.latitude ?? c.latitude;
      c.longitude = params.payload.longitude ?? c.longitude;
      return c;
    }
    const citizen: CitizenRow = {
      id: crypto.randomUUID(),
      fullName: params.payload.fullName ?? null,
      documentId: params.payload.documentId ?? null,
      addressLine: params.payload.addressLine ?? null,
      neighborhood: params.payload.neighborhood ?? null,
      latitude: params.payload.latitude ?? null,
      longitude: params.payload.longitude ?? null,
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
    });
    return { animalId, municipalId };
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

  async getPendingAnimalIdForSession() {
    return this.animals.at(-1)?.id ?? null;
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
