import {
  applyRegistrationTransition,
  formatRegistrationMessage,
  jobPayloadSchema,
  startRegistrationSession,
  type InboundKind,
  type RegistrationStep,
  type SessionPayload,
} from "@epuyen/shared";
import { renderEffect } from "../features/registration/effects.js";
import type { JobContext } from "./types.js";

// process_inbound - load/create session, apply transitions, enqueue outbound/media

export async function handleProcessInbound(
  rawPayload: unknown,
  ctx: JobContext,
): Promise<void> {
  if (!ctx.petRegistryEnabled) return;

  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "process_inbound") {
    throw new Error("WRONG_JOB_TYPE");
  }

  const message = await ctx.store.getMessage(payload.messageId);
  if (!message) {
    throw new Error("MESSAGE_NOT_FOUND");
  }

  await ctx.store.runWithSessionLock(
    payload.lineId,
    message.phoneNormalized,
    async () => {
      await processInboundLocked(payload, message, ctx);
    },
  );
}

async function processInboundLocked(
  payload: {
    type: "process_inbound";
    messageId: string;
    lineId: string;
    orgId: string;
  },
  message: {
    id: string;
    phoneNormalized: string;
    kind: string;
    body: string | null;
    mediaUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  },
  ctx: JobContext,
): Promise<void> {
  const settings = await ctx.store.getOrgSettings(payload.orgId);
  const citizen = await ctx.store.findCitizenByPhone(
    payload.orgId,
    message.phoneNormalized,
  );
  const isReturning = Boolean(citizen);

  let session = await ctx.store.lockSession(payload.lineId, message.phoneNormalized);

  // Idempotent short-circuit: already completed this session
  if (session?.payload.completedAnimalId && session.step === "done") {
    const confirmation = formatRegistrationMessage("registration.already_done");
    await ctx.store.enqueueJob(payload.orgId, {
      type: "send_outbound",
      lineId: payload.lineId,
      phone: message.phoneNormalized,
      text: confirmation,
    });
    return;
  }

  if (!session) {
    const started = startRegistrationSession({
      isReturningCitizen: isReturning,
      citizenFullName: citizen?.fullName ?? undefined,
    });
    const startedPayload: SessionPayload = {
      ...started.payload,
      citizenId: citizen?.id,
    };
    hydrateCitizenGeo(startedPayload, citizen);
    session = await ctx.store.upsertSession({
      id: crypto.randomUUID(),
      orgId: payload.orgId,
      lineId: payload.lineId,
      phoneNormalized: message.phoneNormalized,
      step: started.step,
      payload: startedPayload,
      expiresAt: new Date(Date.now() + settings.ttlHours * 3600_000),
    });

    for (const effect of started.effects) {
      const rendered = renderEffect(effect);
      await ctx.store.enqueueJob(payload.orgId, {
        type: "send_outbound",
        lineId: payload.lineId,
        phone: message.phoneNormalized,
        text: rendered.text,
        buttons: rendered.buttons,
      });
    }
    // Cold start: opener only triggers greeting; next message advances the step
    return;
  }

  const kind = (message.kind as InboundKind) || "unknown";
  const text = message.body ?? undefined;

  const result = applyRegistrationTransition({
    step: session.step,
    payload: session.payload,
    kind,
    text,
    latitude: message.latitude ?? undefined,
    longitude: message.longitude ?? undefined,
    isReturningCitizen: isReturning,
    citizenFullName: citizen?.fullName ?? undefined,
    expiresAt: session.expiresAt,
    privacyNoticeVersion: settings.privacyNoticeVersion,
  });

  let nextPayload: SessionPayload = { ...result.payload };
  let nextStep: RegistrationStep = result.nextStep;
  hydrateCitizenGeo(nextPayload, citizen);

  if (kind === "image" && message.mediaUrl) {
    const mediaKind =
      session.step === "health_card_photo_optional" ? "health_card" : "animal";
    const pending = [...(nextPayload.pendingMediaMessageIds ?? []), message.id];
    nextPayload.pendingMediaMessageIds = pending;
    nextPayload.pendingMediaKinds = {
      ...(nextPayload.pendingMediaKinds ?? {}),
      [message.id]: mediaKind,
    };
    await ctx.store.enqueueJob(payload.orgId, {
      type: "download_media",
      messageId: message.id,
      orgId: payload.orgId,
      mediaUrl: message.mediaUrl,
      kind: mediaKind,
      sessionId: session.id,
    });
  }

  let completeRegistration = result.completeRegistration;

  // Short-circuit if a prior completion already stored the animal id
  if (completeRegistration && nextPayload.completedAnimalId) {
    nextStep = "done";
    completeRegistration = false;
    const confirmation = formatRegistrationMessage("registration.confirmation", {
      animalName: nextPayload.animalName ?? "",
      municipalId: nextPayload.completedMunicipalId ?? "",
    });
    await ctx.store.enqueueJob(payload.orgId, {
      type: "send_outbound",
      lineId: payload.lineId,
      phone: message.phoneNormalized,
      text: confirmation,
    });
  }

  // Photo→finish race: do not complete until pending media have storagePath
  if (completeRegistration) {
    const pendingIds = nextPayload.pendingMediaMessageIds ?? [];
    const pendingReady: { id: string; storagePath: string; kind: "animal" | "health_card" }[] =
      [];
    let mediaPending = false;
    for (const messageId of pendingIds) {
      const mediaMessage = await ctx.store.getMessage(messageId);
      if (!mediaMessage?.storagePath) {
        mediaPending = true;
        break;
      }
      pendingReady.push({
        id: messageId,
        storagePath: mediaMessage.storagePath,
        kind: nextPayload.pendingMediaKinds?.[messageId] ?? "animal",
      });
    }
    if (mediaPending || pendingReady.length < 1) {
      completeRegistration = false;
      nextStep = "animal_photos";
      await ctx.store.enqueueJob(payload.orgId, {
        type: "send_outbound",
        lineId: payload.lineId,
        phone: message.phoneNormalized,
        text: formatRegistrationMessage("animal.photos_saving"),
      });
    } else {
      // Mark completing first under lock before animal insert (idempotency guard)
      nextStep = "completing";
      await ctx.store.upsertSession({
        ...session,
        step: "completing",
        payload: nextPayload,
        expiresAt: session.expiresAt,
      });

      // Re-read under lock in case a concurrent worker finished
      const reloaded = await ctx.store.lockSession(
        payload.lineId,
        message.phoneNormalized,
      );
      if (reloaded?.payload.completedAnimalId) {
        nextPayload = {
          ...nextPayload,
          completedAnimalId: reloaded.payload.completedAnimalId,
          completedMunicipalId: reloaded.payload.completedMunicipalId,
        };
        nextStep = "done";
        const confirmation = formatRegistrationMessage("registration.confirmation", {
          animalName: nextPayload.animalName ?? "",
          municipalId: nextPayload.completedMunicipalId ?? "",
        });
        await ctx.store.enqueueJob(payload.orgId, {
          type: "send_outbound",
          lineId: payload.lineId,
          phone: message.phoneNormalized,
          text: confirmation,
        });
        await ctx.store.upsertSession({
          ...session,
          step: "done",
          payload: nextPayload,
          expiresAt: session.expiresAt,
        });
        return;
      }

      const ensuredCitizen = await ctx.store.upsertCitizenFromPayload({
        orgId: payload.orgId,
        phone: message.phoneNormalized,
        payload: nextPayload,
      });
      nextPayload = { ...nextPayload, citizenId: ensuredCitizen.id };

      const completed = await ctx.store.completeAnimalRegistration({
        orgId: payload.orgId,
        citizenId: ensuredCitizen.id,
        payload: nextPayload,
      });

      const marked = await ctx.store.markSessionCompleted({
        sessionId: session.id,
        animalId: completed.animalId,
        municipalId: completed.municipalId,
        payload: nextPayload,
      });
      nextPayload = {
        ...nextPayload,
        completedAnimalId: marked.animalId,
        completedMunicipalId: marked.municipalId,
      };
      nextStep = "done";

      if (!marked.alreadyDone) {
        for (const media of pendingReady) {
          await ctx.store.linkAnimalPhoto({
            orgId: payload.orgId,
            animalId: marked.animalId,
            kind: media.kind,
            storagePath: media.storagePath,
            messageId: media.id,
          });
        }

        await ctx.store.enqueueJob(payload.orgId, {
          type: "analyze_traits",
          animalId: marked.animalId,
          orgId: payload.orgId,
        });
      }

      const confirmation = formatRegistrationMessage("registration.confirmation", {
        animalName: nextPayload.animalName ?? "",
        municipalId: marked.municipalId,
      });
      await ctx.store.enqueueJob(payload.orgId, {
        type: "send_outbound",
        lineId: payload.lineId,
        phone: message.phoneNormalized,
        text: confirmation,
      });

      // Session already marked done by markSessionCompleted; ensure in-memory shape
      await ctx.store.upsertSession({
        ...session,
        step: "done",
        payload: nextPayload,
        expiresAt: result.expired
          ? new Date(Date.now() + settings.ttlHours * 3600_000)
          : session.expiresAt,
      });
      return;
    }
  }

  await ctx.store.upsertSession({
    ...session,
    step: nextStep,
    payload: nextPayload,
    expiresAt: result.expired
      ? new Date(Date.now() + settings.ttlHours * 3600_000)
      : session.expiresAt,
  });

  if (!completeRegistration) {
    for (const effect of result.effects) {
      // Skip completing noise when we overrode to photos_saving
      if (
        nextStep === "animal_photos" &&
        effect.messageKey === "registration.completing"
      ) {
        continue;
      }
      const rendered = renderEffect(effect);
      await ctx.store.enqueueJob(payload.orgId, {
        type: "send_outbound",
        lineId: payload.lineId,
        phone: message.phoneNormalized,
        text: rendered.text,
        buttons: rendered.buttons,
      });
    }
  }
}

function hydrateCitizenGeo(
  payload: SessionPayload,
  citizen: {
    latitude: number | null;
    longitude: number | null;
    neighborhood: string | null;
    fullName: string | null;
    documentId: string | null;
    addressLine: string | null;
    privacyConsentAt: string | null;
    privacyNoticeVersion: string | null;
  } | null,
): void {
  if (!citizen) return;
  if (payload.latitude == null && citizen.latitude != null) {
    payload.latitude = citizen.latitude;
  }
  if (payload.longitude == null && citizen.longitude != null) {
    payload.longitude = citizen.longitude;
  }
  if (payload.neighborhood == null && citizen.neighborhood) {
    payload.neighborhood = citizen.neighborhood;
  }
  if (payload.fullName == null && citizen.fullName) {
    payload.fullName = citizen.fullName;
  }
  if (payload.documentId == null && citizen.documentId) {
    payload.documentId = citizen.documentId;
  }
  if (payload.addressLine == null && citizen.addressLine) {
    payload.addressLine = citizen.addressLine;
  }
  if (payload.privacyConsentAt == null && citizen.privacyConsentAt) {
    payload.privacyConsentAt = citizen.privacyConsentAt;
  }
  if (payload.privacyNoticeVersion == null && citizen.privacyNoticeVersion) {
    payload.privacyNoticeVersion = citizen.privacyNoticeVersion;
  }
}
