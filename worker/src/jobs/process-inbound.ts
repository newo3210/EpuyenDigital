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

  const settings = await ctx.store.getOrgSettings(payload.orgId);
  const citizen = await ctx.store.findCitizenByPhone(
    payload.orgId,
    message.phoneNormalized,
  );
  const isReturning = Boolean(citizen);

  let session = await ctx.store.lockSession(payload.lineId, message.phoneNormalized);
  if (!session) {
    const started = startRegistrationSession({
      isReturningCitizen: isReturning,
      citizenFullName: citizen?.fullName ?? undefined,
    });
    session = await ctx.store.upsertSession({
      id: crypto.randomUUID(),
      orgId: payload.orgId,
      lineId: payload.lineId,
      phoneNormalized: message.phoneNormalized,
      step: started.step,
      payload: {
        ...started.payload,
        citizenId: citizen?.id,
      },
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

  if (kind === "image" && message.mediaUrl) {
    const pending = [...(nextPayload.pendingMediaMessageIds ?? []), message.id];
    nextPayload.pendingMediaMessageIds = pending;
    await ctx.store.enqueueJob(payload.orgId, {
      type: "download_media",
      messageId: message.id,
      orgId: payload.orgId,
      mediaUrl: message.mediaUrl,
      kind:
        session.step === "health_card_photo_optional" ? "health_card" : "animal",
      sessionId: session.id,
    });
  }

  if (result.completeRegistration) {
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

    for (const messageId of nextPayload.pendingMediaMessageIds ?? []) {
      const mediaMessage = await ctx.store.getMessage(messageId);
      if (mediaMessage?.storagePath) {
        await ctx.store.linkAnimalPhoto({
          orgId: payload.orgId,
          animalId: completed.animalId,
          kind: "animal",
          storagePath: mediaMessage.storagePath,
          messageId,
        });
      }
    }

    await ctx.store.enqueueJob(payload.orgId, {
      type: "analyze_traits",
      animalId: completed.animalId,
      orgId: payload.orgId,
    });

    nextStep = "done";
    const confirmation = formatRegistrationMessage("registration.confirmation", {
      animalName: nextPayload.animalName ?? "",
      municipalId: completed.municipalId,
    });
    await ctx.store.enqueueJob(payload.orgId, {
      type: "send_outbound",
      lineId: payload.lineId,
      phone: message.phoneNormalized,
      text: confirmation,
    });
  }

  await ctx.store.upsertSession({
    ...session,
    step: nextStep,
    payload: nextPayload,
    expiresAt: result.expired
      ? new Date(Date.now() + settings.ttlHours * 3600_000)
      : session.expiresAt,
  });

  if (!result.completeRegistration) {
    for (const effect of result.effects) {
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
