import {
  applyRegistrationTransition,
  formatRegistrationMessage,
  jobPayloadSchema,
  startRegistrationSession,
  type InboundKind,
  type OutboundEffect,
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

  // Idempotent short-circuit: already completed this session (any step)
  if (session?.payload.completedAnimalId) {
    if (session.step !== "done") {
      await ctx.store.upsertSession({
        ...session,
        step: "done",
        payload: session.payload,
        expiresAt: session.expiresAt,
      });
    }
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
      await enqueueEffect(ctx, payload, message.phoneNormalized, effect);
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
  let effects: OutboundEffect[] = [...result.effects];
  hydrateCitizenGeo(nextPayload, citizen);

  // location_help: after sending help text+image, advance to location ask
  if (nextStep === "location_help") {
    nextStep = "location";
    effects = [
      ...effects,
      { messageKey: "citizen.ask_location" },
    ];
  }

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

  const citizenFullName =
    nextPayload.fullName ?? citizen?.fullName ?? "";

  // Short-circuit if a prior completion already stored the animal id
  if (completeRegistration && nextPayload.completedAnimalId) {
    nextStep = "done";
    completeRegistration = false;
    const confirmation = formatRegistrationMessage("registration.confirmation", {
      animalName: nextPayload.animalName ?? "",
      citizenFullName,
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
      // Persist latest payload (still animal_photos/completing) then atomic finalize
      await ctx.store.upsertSession({
        ...session,
        step: "completing",
        payload: nextPayload,
        expiresAt: session.expiresAt,
      });

      const ensuredCitizen = await ctx.store.upsertCitizenFromPayload({
        orgId: payload.orgId,
        phone: message.phoneNormalized,
        payload: nextPayload,
      });
      nextPayload = { ...nextPayload, citizenId: ensuredCitizen.id };

      const finalized = await ctx.store.finalizeRegistrationCompletion({
        sessionId: session.id,
        citizenId: ensuredCitizen.id,
        payload: nextPayload,
        photos: pendingReady.map((m) => ({
          kind: m.kind,
          storagePath: m.storagePath,
          messageId: m.id,
        })),
      });

      nextPayload = {
        ...nextPayload,
        completedAnimalId: finalized.animalId,
        completedMunicipalId: finalized.municipalId,
      };
      nextStep = "done";

      if (!finalized.alreadyDone) {
        await ctx.store.enqueueJob(payload.orgId, {
          type: "analyze_traits",
          animalId: finalized.animalId,
          orgId: payload.orgId,
        });
      }

      const confirmation = formatRegistrationMessage("registration.confirmation", {
        animalName: nextPayload.animalName ?? "",
        citizenFullName: nextPayload.fullName ?? ensuredCitizen.fullName ?? "",
        municipalId: finalized.municipalId,
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
    for (const effect of effects) {
      // Skip completing noise when we overrode to photos_saving
      if (
        nextStep === "animal_photos" &&
        effect.messageKey === "registration.completing"
      ) {
        continue;
      }
      await enqueueEffect(ctx, payload, message.phoneNormalized, effect);
    }
  }
}

// enqueueEffect - render effect and enqueue text (+ optional help image)
async function enqueueEffect(
  ctx: JobContext,
  payload: { orgId: string; lineId: string },
  phone: string,
  effect: OutboundEffect,
): Promise<void> {
  const rendered = renderEffect(effect);
  if (rendered.sendMedia === "location_help" && ctx.locationHelpImagePath) {
    await ctx.store.enqueueJob(payload.orgId, {
      type: "send_outbound",
      lineId: payload.lineId,
      phone,
      text: rendered.text,
      mediaPath: ctx.locationHelpImagePath,
    });
    return;
  }
  await ctx.store.enqueueJob(payload.orgId, {
    type: "send_outbound",
    lineId: payload.lineId,
    phone,
    text: rendered.text,
    buttons: rendered.buttons,
  });
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
  // UX v2: do not hydrate neighborhood — municipal ID stays EPU
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
