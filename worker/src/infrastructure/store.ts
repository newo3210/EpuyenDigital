import type {
  JobPayload,
  RegistrationStep,
  SessionPayload,
  VisionTraits,
} from "@epuyen/shared";

// Worker store - persistence ports for registration jobs

export type MessageRow = {
  id: string;
  orgId: string;
  lineId: string;
  phoneNormalized: string;
  kind: string;
  body: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  latitude: number | null;
  longitude: number | null;
  storagePath: string | null;
};

export type SessionRow = {
  id: string;
  orgId: string;
  lineId: string;
  phoneNormalized: string;
  step: RegistrationStep;
  payload: SessionPayload;
  expiresAt: Date;
};

export type CitizenRow = {
  id: string;
  fullName: string | null;
  documentId: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  privacyConsentAt: string | null;
  privacyNoticeVersion: string | null;
};

export type OrgSettingsRow = {
  sendMode: "dry_run" | "allowlist" | "production";
  allowlistPhones: string[];
  ttlHours: number;
  privacyNoticeVersion: string;
};

export type CompleteAnimalResult = {
  animalId: string;
  municipalId: string;
};

export type WorkerStore = {
  claimNextJob(): Promise<{ id: string; payload: JobPayload; attempts: number; maxAttempts: number } | null>;
  markJobDone(id: string): Promise<void>;
  markJobFailed(id: string, error: string, retry: boolean): Promise<void>;
  getMessage(id: string): Promise<MessageRow | null>;
  getOrgSettings(orgId: string): Promise<OrgSettingsRow>;
  findCitizenByPhone(orgId: string, phone: string): Promise<CitizenRow | null>;
  /** Load session under row lock (SQL FOR UPDATE / memory mutex scope). */
  lockSession(lineId: string, phone: string): Promise<SessionRow | null>;
  /**
   * Serialize process_inbound for one phone. Memory: async mutex.
   * Supabase: claim_session_processing lease for the critical section duration.
   */
  runWithSessionLock<T>(
    lineId: string,
    phone: string,
    fn: () => Promise<T>,
  ): Promise<T>;
  upsertSession(session: SessionRow): Promise<SessionRow>;
  upsertCitizenFromPayload(params: {
    orgId: string;
    phone: string;
    payload: SessionPayload;
  }): Promise<CitizenRow>;
  completeAnimalRegistration(params: {
    orgId: string;
    citizenId: string;
    payload: SessionPayload;
  }): Promise<CompleteAnimalResult>;
  /**
   * Persist completedAnimalId on session; returns prior id if already set (idempotent).
   */
  markSessionCompleted(params: {
    sessionId: string;
    animalId: string;
    municipalId: string;
    payload: SessionPayload;
  }): Promise<CompleteAnimalResult & { alreadyDone: boolean }>;
  /**
   * Atomic completion: lock session, insert animal once, link photos, mark done.
   * Preferred over completeAnimalRegistration + markSessionCompleted + link loops.
   */
  finalizeRegistrationCompletion(params: {
    sessionId: string;
    citizenId: string;
    payload: SessionPayload;
    photos: {
      kind: "animal" | "health_card";
      storagePath: string;
      messageId?: string;
    }[];
  }): Promise<CompleteAnimalResult & { alreadyDone: boolean }>;
  enqueueJob(orgId: string | null, payload: JobPayload): Promise<void>;
  persistOutbound(params: {
    orgId: string;
    lineId: string;
    phone: string;
    text: string;
    deliveryStatus: "sent" | "blocked" | "simulated";
    externalId?: string;
  }): Promise<void>;
  getLineInstance(lineId: string): Promise<{ instance: string; orgId: string } | null>;
  saveMedia(params: {
    orgId: string;
    path: string;
    bytes: Uint8Array;
    mime: string;
  }): Promise<string>;
  linkAnimalPhoto(params: {
    orgId: string;
    animalId: string;
    kind: "animal" | "health_card";
    storagePath: string;
    messageId?: string;
  }): Promise<void>;
  updateMessageStorage(messageId: string, storagePath: string): Promise<void>;
  listAnimalPhotoPaths(animalId: string): Promise<{ path: string; mime?: string }[]>;
  readStorage(path: string): Promise<{ bytes: Uint8Array; mime: string }>;
  updateAnimalTraits(params: {
    animalId: string;
    traits: VisionTraits | null;
    status: "ready" | "pending_manual";
  }): Promise<void>;
  getPendingAnimalIdForSession(sessionId: string): Promise<string | null>;
};
