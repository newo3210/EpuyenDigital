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
  botPaused?: boolean;
  mesaBotEnabled?: boolean;
  botConfidenceThreshold?: number;
  privacyNoticeText?: string;
  outOfHoursMessage?: string;
  businessHours?: Record<string, [string, string][]>;
  holidays?: string[];
};

export type BotConversationRow = {
  id: string;
  orgId: string;
  lineId: string;
  phoneNormalized: string;
  ownerUserId: string | null;
  botState: "active" | "paused" | "handoff";
  privacyNoticeSentAt: string | null;
  handoffAckSentAt: string | null;
  botAwaitingClarification: boolean;
};

export type KnowledgeDocumentRow = {
  id: string;
  orgId: string;
  title: string;
  bodyText: string | null;
  storagePath: string | null;
  isActive: boolean;
};

export type KnowledgeHitRow = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
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
    senderKind?: "bot" | "operator" | "system" | "phone";
  }): Promise<void>;
  getLineInstance(lineId: string): Promise<{ instance: string; orgId: string } | null>;
  getExternalTaskNotify(taskId: string): Promise<{
    publicRef: string;
    title: string;
    externalPhone: string | null;
    lineId: string | null;
  } | null>;
  abandonStaleTasks(): Promise<number>;
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
  getConversationForBot?(conversationId: string): Promise<BotConversationRow | null>;
  hasOpenPetSession?(lineId: string, phone: string): Promise<boolean>;
  searchKnowledge?(orgId: string, query: string, limit?: number): Promise<KnowledgeHitRow[]>;
  insertBotRun?(params: {
    orgId: string;
    conversationId: string;
    triggerMessageId: string | null;
    decision: string;
    answer: string | null;
    sources: unknown;
    confidence: number | null;
    handoffReason: string | null;
    topic?: string | null;
    urgency?: string | null;
    extractedFields?: unknown;
    model?: string | null;
    latencyMs?: number | null;
  }): Promise<string>;
  markPrivacyNoticeSent?(conversationId: string): Promise<void>;
  markHandoff?(params: {
    conversationId: string;
    sendAck: boolean;
  }): Promise<void>;
  setBotAwaitingClarification?(conversationId: string, awaiting: boolean): Promise<void>;
  getKnowledgeDocument?(documentId: string): Promise<KnowledgeDocumentRow | null>;
  replaceKnowledgeChunks?(
    documentId: string,
    chunks: Array<{ chunkIndex: number; content: string; metadata?: Record<string, unknown> }>,
  ): Promise<number>;
  createBotSummaryNote?(params: {
    orgId: string;
    conversationId: string;
    body: string;
  }): Promise<void>;
  updateMessageBody?(messageId: string, body: string): Promise<void>;
};