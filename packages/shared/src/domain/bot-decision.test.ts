import { describe, expect, it } from "vitest";
import { chunkKnowledgeText, decideBotReply } from "./bot-decision.js";

const base = {
  killSwitch: false,
  orgBotPaused: false,
  mesaBotEnabled: true,
  hasHumanOwner: false,
  botState: "active" as const,
  openPetSession: false,
  privacyNoticeSent: true,
  privacyNoticeText: "Aviso",
  withinBusinessHours: true,
  outOfHoursMessage: "Fuera de horario",
  citizenText: "horario de rentas",
  awaitingClarification: false,
  hits: [] as Array<{
    chunkId: string;
    documentId: string;
    title: string;
    content: string;
    score: number;
  }>,
  confidenceThreshold: 0.55,
  handoffAckSent: false,
};

describe("decideBotReply", () => {
  it("stays silent on kill switch, pause, owner, handoff, open pet session, and empty text", () => {
    expect(decideBotReply({ ...base, killSwitch: true }).decision).toBe("silent");
    expect(decideBotReply({ ...base, orgBotPaused: true }).decision).toBe("silent");
    expect(decideBotReply({ ...base, hasHumanOwner: true }).decision).toBe("silent");
    expect(decideBotReply({ ...base, botState: "handoff" }).decision).toBe("silent");
    expect(decideBotReply({ ...base, openPetSession: true }).decision).toBe("silent");
    expect(decideBotReply({ ...base, citizenText: "   " }).decision).toBe("silent");
  });

  it("sends privacy notice once before RAG", () => {
    const result = decideBotReply({ ...base, privacyNoticeSent: false });
    expect(result.decision).toBe("answered");
    if (result.decision !== "silent") {
      expect(result.replyText).toBe("Aviso");
    }
  });

  it("hands off out of hours and citizen request once", () => {
    const hours = decideBotReply({ ...base, withinBusinessHours: false });
    expect(hours.decision).toBe("handoff");
    if (hours.decision !== "silent") {
      expect(hours.handoffReason).toBe("out_of_hours");
      expect(hours.sendHandoffAck).toBe(true);
    }
    const human = decideBotReply({
      ...base,
      citizenText: "quiero hablar con alguien",
      handoffAckSent: true,
    });
    expect(human.decision).toBe("handoff");
    if (human.decision !== "silent") {
      expect(human.sendHandoffAck).toBe(false);
    }
  });

  it("answers from high-confidence hits and clarifies then handoffs on low confidence", () => {
    const answered = decideBotReply({
      ...base,
      hits: [
        {
          chunkId: "c1",
          documentId: "d1",
          title: "Rentas",
          content: "Rentas atiende de 8 a 14.",
          score: 0.9,
        },
      ],
    });
    expect(answered.decision).toBe("answered");

    const clarify = decideBotReply({
      ...base,
      hits: [
        {
          chunkId: "c1",
          documentId: "d1",
          title: "Rentas",
          content: "parcial",
          score: 0.2,
        },
      ],
    });
    expect(clarify.decision).toBe("asked_clarification");

    const handoff = decideBotReply({
      ...base,
      awaitingClarification: true,
      hits: [
        {
          chunkId: "c1",
          documentId: "d1",
          title: "Rentas",
          content: "parcial",
          score: 0.2,
        },
      ],
    });
    expect(handoff.decision).toBe("handoff");
  });
});

describe("chunkKnowledgeText", () => {
  it("splits long bodies into bounded chunks", () => {
    const chunks = chunkKnowledgeText("uno\n\ndos\n\n" + "x".repeat(900), 400);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 400)).toBe(true);
  });
});
