import {
  DEFAULT_BUSINESS_HOURS,
  decideBotReply,
  extractProposedFields,
  isWithinBusinessHours,
  jobPayloadSchema,
  type BusinessHours,
} from "@epuyen/shared";
import type { JobContext } from "./types.js";

// bot_reply - mesa RAG decision tree; silent when pet session or human owns the thread.

export async function handleBotReply(rawPayload: unknown, ctx: JobContext): Promise<void> {
  const payload = jobPayloadSchema.parse(rawPayload);
  if (payload.type !== "bot_reply") throw new Error("WRONG_JOB_TYPE");
  const store = ctx.store;
  if (!store.getConversationForBot || !store.insertBotRun) {
    throw new Error("BOT_STORE_UNAVAILABLE");
  }

  const message = await store.getMessage(payload.messageId);
  if (!message) throw new Error("MESSAGE_NOT_FOUND");

  const conversation = await store.getConversationForBot(payload.conversationId);
  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

  if (!ctx.mesaBotEnabled) {
    await store.insertBotRun({
      orgId: payload.orgId,
      conversationId: payload.conversationId,
      triggerMessageId: payload.messageId,
      decision: "silent",
      answer: null,
      sources: [],
      confidence: null,
      handoffReason: "paused",
      model: "rules+rag",
      latencyMs: 0,
    });
    return;
  }

  const settings = await store.getOrgSettings(payload.orgId);
  let openPetSession = store.hasOpenPetSession
    ? await store.hasOpenPetSession(payload.lineId, message.phoneNormalized)
    : false;
  // Pet race: process_inbound may still be creating the session; re-check once.
  if (!openPetSession && ctx.petRegistryEnabled && store.hasOpenPetSession) {
    await new Promise((resolve) => setTimeout(resolve, 75));
    openPetSession = await store.hasOpenPetSession(payload.lineId, message.phoneNormalized);
  }

  const hours = (settings.businessHours as BusinessHours | undefined) ?? DEFAULT_BUSINESS_HOURS;
  const withinHours = isWithinBusinessHours(new Date(), hours, settings.holidays ?? []);

  const query = (message.body ?? "").trim();
  const hits =
    query && store.searchKnowledge
      ? await store.searchKnowledge(payload.orgId, query, 5)
      : [];

  const started = Date.now();
  const decision = decideBotReply({
    killSwitch: Boolean(ctx.botKillSwitch),
    orgBotPaused: Boolean(settings.botPaused),
    mesaBotEnabled: settings.mesaBotEnabled !== false,
    hasHumanOwner: Boolean(conversation.ownerUserId),
    botState: conversation.botState,
    openPetSession,
    privacyNoticeSent: Boolean(conversation.privacyNoticeSentAt),
    privacyNoticeText:
      settings.privacyNoticeText ??
      "Aviso de privacidad (Ley 25.326): tus datos se usan solo para atender tu consulta municipal.",
    withinBusinessHours: withinHours,
    outOfHoursMessage:
      settings.outOfHoursMessage ??
      "Estamos fuera del horario de atención. Tu mensaje queda en cola y te respondemos a la brevedad.",
    citizenText: query,
    awaitingClarification: conversation.botAwaitingClarification,
    hits,
    confidenceThreshold: settings.botConfidenceThreshold ?? 0.55,
    handoffAckSent: Boolean(conversation.handoffAckSentAt),
  });

  const latencyMs = Date.now() - started;
  const answer = decision.decision === "silent" ? null : decision.replyText;
  const confidence = decision.decision === "silent" ? null : decision.confidence;
  const sources = decision.decision === "silent" ? [] : decision.sources;
  const handoffReason = decision.handoffReason;

  const extractedFields = extractProposedFields(query);
  await store.insertBotRun({
    orgId: payload.orgId,
    conversationId: payload.conversationId,
    triggerMessageId: payload.messageId,
    decision: decision.decision,
    answer,
    sources,
    confidence,
    handoffReason,
    extractedFields,
    model: "rules+rag",
    latencyMs,
  });

  if (decision.decision === "silent") return;

  if (decision.decision === "answered" && !conversation.privacyNoticeSentAt) {
    await store.markPrivacyNoticeSent?.(payload.conversationId);
  }

  if (decision.decision === "asked_clarification") {
    await store.setBotAwaitingClarification?.(payload.conversationId, true);
  } else if (decision.decision === "answered") {
    await store.setBotAwaitingClarification?.(payload.conversationId, false);
  }

  if (decision.decision === "handoff") {
    await store.markHandoff?.({
      conversationId: payload.conversationId,
      sendAck: decision.sendHandoffAck,
    });
  }

  if (decision.decision === "handoff" && !decision.sendHandoffAck) {
    // Ack already sent this episode — still persist run, skip duplicate WhatsApp.
    return;
  }

  await store.enqueueJob(payload.orgId, {
    type: "send_outbound",
    lineId: payload.lineId,
    phone: message.phoneNormalized,
    text: decision.replyText.slice(0, 4096),
    senderKind: "bot",
  });
}
