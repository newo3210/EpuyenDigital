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
});
