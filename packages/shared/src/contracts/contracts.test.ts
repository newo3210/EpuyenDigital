import { describe, expect, it } from "vitest";
import { animalDraftSchema } from "./animal.js";
import { citizenUpsertSchema } from "./citizen.js";
import { evolutionWebhookSchema } from "./evolution-webhook.js";
import { jobPayloadSchema } from "./jobs.js";
import { outboundTextSchema } from "./outbound.js";
import { registrationSessionSchema } from "./registration-session.js";
import { visionTraitsSchema } from "./vision-traits.js";

describe("Zod contracts", () => {
  it("accepts normalized webhook", () => {
    const parsed = evolutionWebhookSchema.parse({
      externalId: "wamid.1",
      instance: "inspectoria",
      phoneRaw: "+54 9 2944 216586",
      phoneNormalized: "5492944216586",
      kind: "text",
      text: "hola",
    });
    expect(parsed.kind).toBe("text");
  });

  it("validates registration session and citizen/animal drafts", () => {
    expect(() =>
      registrationSessionSchema.parse({
        orgId: "00000000-0000-4000-8000-000000000001",
        lineId: "00000000-0000-4000-8000-000000000002",
        phoneNormalized: "5492944216586",
        step: "welcome",
        expiresAt: new Date().toISOString(),
      }),
    ).not.toThrow();

    expect(
      citizenUpsertSchema.parse({
        fullName: "Ana",
        documentId: "30111222",
        addressLine: "Calle 1",
        phoneNormalized: "5491111111111",
      }).fullName,
    ).toBe("Ana");

    expect(
      citizenUpsertSchema.parse({
        fullName: "Ana",
        documentId: "30111222",
        addressLine: "Calle 1",
        neighborhood: null,
        latitude: null,
        longitude: null,
        privacyConsentAt: null,
        phoneNormalized: "5491111111111",
      }).latitude,
    ).toBeNull();

    expect(
      animalDraftSchema.parse({
        name: "Luna",
        species: "dog",
        sex: "female",
        breedColor: "mestiza negra",
        size: "medium",
        ageStage: "adulto",
        sterilized: "yes",
        rabiesStatus: "unknown",
      }).rabiesStatus,
    ).toBe("unknown");
  });

  it("validates vision traits and outbound/job payloads", () => {
    expect(
      visionTraitsSchema.parse({
        summary: "Perro negro",
        colors: ["negro"],
        markings: [],
        notableFeatures: ["orejas caídas"],
      }).summary,
    ).toBe("Perro negro");

    expect(
      outboundTextSchema.parse({
        phone: "5492944216586",
        text: "Hola",
        lineId: "00000000-0000-4000-8000-000000000002",
      }).phone,
    ).toBe("5492944216586");

    expect(
      jobPayloadSchema.parse({
        type: "process_inbound",
        messageId: "00000000-0000-4000-8000-000000000003",
        lineId: "00000000-0000-4000-8000-000000000002",
        orgId: "00000000-0000-4000-8000-000000000001",
      }).type,
    ).toBe("process_inbound");
  });

  it("rejects horse species", () => {
    expect(() =>
      animalDraftSchema.parse({
        name: "Rocinante",
        species: "horse",
        sex: "male",
        breedColor: "alazan",
        size: "large",
        ageStage: "adulto",
        sterilized: "no",
        rabiesStatus: "pending",
      }),
    ).toThrow();
  });
});
