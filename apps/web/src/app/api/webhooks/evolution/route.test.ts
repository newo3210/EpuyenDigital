import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeEvolutionPayload } from "@/infrastructure/normalize-evolution";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("evolution webhook thinness", () => {
  it("route source does not import LLM, Evolution send, or media download", () => {
    const routePath = path.join(here, "route.ts");
    const src = readFileSync(routePath, "utf8");
    expect(src).not.toMatch(/vision-client|VisionClient|OpenAiCompatible/);
    expect(src).not.toMatch(/HttpEvolutionClient|sendText|downloadMedia/);
    expect(src).not.toMatch(/analyze_traits|handleSendOutbound/);
  });

  it("ignores group payloads", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: { id: "g1", remoteJid: "120363@g.us" },
        message: { conversation: "hola grupo" },
      },
    });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe("group");
  });

  it("ignores newsletter payloads", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: { id: "n1", remoteJid: "120363@newsletter" },
        message: { conversation: "promo" },
      },
    });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe("newsletter");
  });

  it("normalizes text inbound", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: { id: "t1", remoteJid: "5492944216586@s.whatsapp.net" },
        message: { conversation: "hola" },
      },
    });
    expect(result.ignored).toBe(false);
    expect(result.event?.kind).toBe("text");
    expect(result.event?.phoneNormalized).toBe("5492944216586");
  });

  it("resolves @lid via remoteJidAlt / senderPn", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: {
          id: "lid1",
          remoteJid: "123456789012345@lid",
          remoteJidAlt: "5492944216586@s.whatsapp.net",
        },
        message: { conversation: "hola lid" },
        pushName: "Ana",
      },
    });
    expect(result.ignored).toBe(false);
    expect(result.event?.phoneNormalized).toBe("5492944216586");
    expect(result.event?.pushName).toBe("Ana");
  });

  it("stores location on the message contract without inventing citizen GPS", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: { id: "loc1", remoteJid: "5492944216586@s.whatsapp.net" },
        message: {
          locationMessage: { degreesLatitude: -42.24, degreesLongitude: -71.37 },
        },
      },
    });
    expect(result.ignored).toBe(false);
    expect(result.event?.kind).toBe("location");
    expect(result.event?.latitude).toBeCloseTo(-42.24);
    expect(result.event?.longitude).toBeCloseTo(-71.37);
  });

  it("normalizes image media inbound", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: { id: "img1", remoteJid: "5492944216586@s.whatsapp.net" },
        message: {
          imageMessage: {
            url: "https://cdn.example.com/photo.jpg",
            mimetype: "image/jpeg",
            caption: "foto",
          },
        },
      },
    });
    expect(result.ignored).toBe(false);
    expect(result.event?.kind).toBe("image");
    expect(result.event?.mediaUrl).toBe("https://cdn.example.com/photo.jpg");
  });

  it("ignores payloads without a stable Evolution message id", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: { remoteJid: "5492944216586@s.whatsapp.net" },
        message: { conversation: "hola" },
      },
    });
    expect(result.ignored).toBe(true);
    expect(result.reason).toBe("invalid");
  });

  it("normalizes fromMe without inventing behavior in the thin route", () => {
    const result = normalizeEvolutionPayload({
      instance: "inspectoria",
      data: {
        key: {
          id: "fm1",
          remoteJid: "5492944216586@s.whatsapp.net",
          fromMe: true,
        },
        message: { conversation: "escrito en el teléfono" },
      },
    });
    expect(result.ignored).toBe(false);
    expect(result.event?.fromMe).toBe(true);
  });

  it("maps messages.update to delivery ACK", () => {
    const result = normalizeEvolutionPayload({
      event: "messages.update",
      instance: "inspectoria",
      data: {
        key: { id: "out-99" },
        status: 2,
      },
    });
    expect(result.ignored).toBe(false);
    expect(result.deliveryAck?.externalId).toBe("out-99");
    expect(result.deliveryAck?.deliveryStatus).toBe("delivered");
  });
});
