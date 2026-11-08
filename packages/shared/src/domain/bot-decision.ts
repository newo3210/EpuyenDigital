// Mesa bot decision tree - pure rules for silent / privacy / hours / RAG / handoff.

export type BotDecisionKind = "answered" | "asked_clarification" | "handoff" | "silent";

export type HandoffReason =
  | "low_confidence"
  | "sensitive_topic"
  | "citizen_requested"
  | "out_of_hours"
  | "empty_knowledge"
  | "kill_switch"
  | "paused";

export type KnowledgeHit = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
};

export type BotDecisionInput = {
  killSwitch: boolean;
  orgBotPaused: boolean;
  mesaBotEnabled: boolean;
  hasHumanOwner: boolean;
  botState: "active" | "paused" | "handoff";
  openPetSession: boolean;
  privacyNoticeSent: boolean;
  privacyNoticeText: string;
  withinBusinessHours: boolean;
  outOfHoursMessage: string;
  citizenText: string;
  awaitingClarification: boolean;
  hits: KnowledgeHit[];
  confidenceThreshold: number;
  handoffAckSent: boolean;
};

export type BotDecisionResult =
  | { decision: "silent"; handoffReason: HandoffReason | null }
  | {
      decision: "answered" | "asked_clarification" | "handoff";
      handoffReason: HandoffReason | null;
      replyText: string;
      confidence: number;
      sources: Array<{ documentId: string; title: string; chunkId: string; score: number }>;
      sendHandoffAck: boolean;
    };

const SENSITIVE =
  /\b(denuncia|violencia|abuso|amenaza|suicidio|arma|droga|menor\s+de\s+edad)\b/i;
const HUMAN_REQUEST =
  /\b(hablar\s+con\s+(alguien|una?\s+persona|un\s+operador|un\s+humano)|quiero\s+una?\s+persona|pasar\s+con\s+operador)\b/i;
const AFFIRM = /^(si|sí|ok|dale|confirmo|correcto)\b/i;

// decideBotReply - apply D1 silent rules then privacy, hours, RAG, clarify, handoff.
export function decideBotReply(input: BotDecisionInput): BotDecisionResult {
  if (input.killSwitch) {
    return { decision: "silent", handoffReason: "kill_switch" };
  }
  if (input.orgBotPaused || !input.mesaBotEnabled) {
    return { decision: "silent", handoffReason: "paused" };
  }
  if (input.hasHumanOwner || input.botState === "paused" || input.botState === "handoff") {
    return { decision: "silent", handoffReason: "paused" };
  }
  if (input.openPetSession) {
    return { decision: "silent", handoffReason: null };
  }

  const text = input.citizenText.trim();
  // Empty body (e.g. media still processing) must not hand off the thread.
  if (!text) {
    return { decision: "silent", handoffReason: null };
  }

  if (!input.privacyNoticeSent) {
    return {
      decision: "answered",
      handoffReason: null,
      replyText: input.privacyNoticeText,
      confidence: 1,
      sources: [],
      sendHandoffAck: false,
    };
  }

  if (!input.withinBusinessHours) {
    return {
      decision: "handoff",
      handoffReason: "out_of_hours",
      replyText: input.outOfHoursMessage,
      confidence: 0,
      sources: [],
      sendHandoffAck: !input.handoffAckSent,
    };
  }

  if (HUMAN_REQUEST.test(text)) {
    return {
      decision: "handoff",
      handoffReason: "citizen_requested",
      replyText:
        "Te paso con una persona del municipio. En breve te van a atender por este mismo chat.",
      confidence: 1,
      sources: [],
      sendHandoffAck: !input.handoffAckSent,
    };
  }

  if (SENSITIVE.test(text)) {
    return {
      decision: "handoff",
      handoffReason: "sensitive_topic",
      replyText:
        "Este tema lo tiene que ver una persona del municipio. Te dejo en la cola de atención.",
      confidence: 1,
      sources: [],
      sendHandoffAck: !input.handoffAckSent,
    };
  }

  if (input.hits.length === 0) {
    if (!input.awaitingClarification && text.length > 0 && !AFFIRM.test(text)) {
      return {
        decision: "asked_clarification",
        handoffReason: null,
        replyText:
          "Para ayudarte mejor, ¿podés contarme un poco más de qué trámite o consulta necesitás?",
        confidence: 0,
        sources: [],
        sendHandoffAck: false,
      };
    }
    return {
      decision: "handoff",
      handoffReason: "empty_knowledge",
      replyText:
        "No encontré información oficial suficiente. Te dejo con el equipo municipal.",
      confidence: 0,
      sources: [],
      sendHandoffAck: !input.handoffAckSent,
    };
  }

  const best = [...input.hits].sort((a, b) => b.score - a.score)[0]!;
  const confidence = Math.min(1, Math.max(0, best.score));
  const sources = input.hits.slice(0, 3).map((hit) => ({
    documentId: hit.documentId,
    title: hit.title,
    chunkId: hit.chunkId,
    score: hit.score,
  }));

  if (confidence < input.confidenceThreshold) {
    if (!input.awaitingClarification) {
      return {
        decision: "asked_clarification",
        handoffReason: null,
        replyText:
          "No estoy seguro de haber entendido bien. ¿Podés reformular tu consulta con más detalle?",
        confidence,
        sources,
        sendHandoffAck: false,
      };
    }
    return {
      decision: "handoff",
      handoffReason: "low_confidence",
      replyText:
        "Prefiero pasarte con una persona para no darte información incorrecta.",
      confidence,
      sources,
      sendHandoffAck: !input.handoffAckSent,
    };
  }

  const citation = sources
    .map((source) => source.title)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 2)
    .join("; ");

  return {
    decision: "answered",
    handoffReason: null,
    replyText: `${best.content.trim()}\n\nFuente: ${citation || "documentación municipal"}`,
    confidence,
    sources,
    sendHandoffAck: false,
  };
}

// extractProposedFields - propose citizen fields for a later confirmation turn (D6).
export function extractProposedFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const dni = text.match(/\b(\d{7,8})\b/);
  if (dni) fields.documentId = dni[1]!;
  const name = text.match(/\bme llamo\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,60})/i);
  if (name) fields.fullName = name[1]!.trim();
  return fields;
}

// chunkKnowledgeText - split long docs into retrieval units.
export function chunkKnowledgeText(body: string, maxChars = 800): string[] {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).trim().length <= maxChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        chunks.push(paragraph.slice(i, i + maxChars));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
