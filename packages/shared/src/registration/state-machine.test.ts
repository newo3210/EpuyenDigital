import { describe, expect, it } from "vitest";
import { applyRegistrationTransition, startRegistrationSession } from "./state-machine.js";

describe("startRegistrationSession", () => {
  it("starts welcome for new citizen (no consent)", () => {
    const s = startRegistrationSession({ isReturningCitizen: false });
    expect(s.step).toBe("welcome");
    expect(s.effects[0]?.messageKey).toBe("welcome.intro");
  });

  it("greets returning citizen", () => {
    const s = startRegistrationSession({
      isReturningCitizen: true,
      citizenFullName: "Ana Pérez",
    });
    expect(s.step).toBe("returning_menu");
    expect(s.effects[0]?.params?.name).toBe("Ana Pérez");
  });
});

describe("applyRegistrationTransition", () => {
  it("welcome advances to full_name without consent", () => {
    const r = applyRegistrationTransition({
      step: "welcome",
      payload: {},
      kind: "text",
      text: "hola",
      isReturningCitizen: false,
    });
    expect(r.nextStep).toBe("full_name");
    expect(r.payload.privacyConsentAt).toBeUndefined();
    expect(r.effects[0]?.messageKey).toBe("citizen.ask_full_name");
  });

  it("enforces citizen then location-help then animal order", () => {
    let step: "full_name" | "document_id" | "address_line" | "location_help_offer" =
      "full_name";
    let payload = {};
    const steps = [
      { text: "Juan López", expectStep: "document_id" },
      { text: "30111222", expectStep: "address_line" },
      { text: "Calle 1", expectStep: "location_help_offer" },
    ] as const;

    for (const s of steps) {
      const r = applyRegistrationTransition({
        step,
        payload,
        kind: "text",
        text: s.text,
        isReturningCitizen: false,
      });
      expect(r.nextStep).toBe(s.expectStep);
      step = r.nextStep as typeof step;
      payload = r.payload;
    }

    const help = applyRegistrationTransition({
      step: "location_help_offer",
      payload,
      kind: "text",
      text: "1",
      isReturningCitizen: false,
    });
    expect(help.nextStep).toBe("location_help");
    expect(help.effects[0]?.sendMedia).toBe("location_help");

    const afterHelp = applyRegistrationTransition({
      step: "location_help",
      payload: help.payload,
      kind: "text",
      text: "ok",
      isReturningCitizen: false,
    });
    expect(afterHelp.nextStep).toBe("location");

    const loc = applyRegistrationTransition({
      step: "location",
      payload: afterHelp.payload,
      kind: "location",
      latitude: -42.1,
      longitude: -71.3,
      isReturningCitizen: false,
    });
    expect(loc.nextStep).toBe("animal_name");
    expect(loc.payload.latitude).toBe(-42.1);
  });

  it("skips GPS with No puedo ahora", () => {
    const r = applyRegistrationTransition({
      step: "location",
      payload: { fullName: "Ana" },
      kind: "text",
      text: "No puedo ahora",
      isReturningCitizen: false,
    });
    expect(r.nextStep).toBe("animal_name");
    expect(r.payload.latitude).toBeUndefined();
    expect(r.payload.longitude).toBeUndefined();
  });

  it("declines location help and asks for pin", () => {
    const r = applyRegistrationTransition({
      step: "location_help_offer",
      payload: {},
      kind: "text",
      text: "2",
      isReturningCitizen: false,
    });
    expect(r.nextStep).toBe("location");
    expect(r.effects[0]?.messageKey).toBe("citizen.ask_location");
    expect(r.effects[0]?.sendMedia).toBeUndefined();
  });

  it("re-prompts location on unrelated text", () => {
    const r = applyRegistrationTransition({
      step: "location",
      payload: {},
      kind: "text",
      text: "estoy en casa",
      isReturningCitizen: false,
    });
    expect(r.nextStep).toBe("location");
    expect(r.effects[0]?.messageKey).toBe("citizen.ask_location_again");
  });

  it("resumes completing without animal id (crash recovery)", () => {
    const r = applyRegistrationTransition({
      step: "completing",
      payload: { animalName: "Luna", animalPhotoCount: 1 },
      kind: "text",
      text: "hola",
      isReturningCitizen: false,
    });
    expect(r.completeRegistration).toBe(true);
    expect(r.nextStep).toBe("completing");
  });

  it("blocks finish without photos then completes with multi-photo + Listo", () => {
    const blocked = applyRegistrationTransition({
      step: "animal_photos",
      payload: { animalPhotoCount: 0 },
      kind: "text",
      text: "listo",
      isReturningCitizen: false,
    });
    expect(blocked.completeRegistration).toBe(false);
    expect(blocked.effects[0]?.messageKey).toBe("animal.photos_required");

    const first = applyRegistrationTransition({
      step: "animal_photos",
      payload: { animalPhotoCount: 0 },
      kind: "image",
      isReturningCitizen: false,
    });
    expect(first.payload.animalPhotoCount).toBe(1);

    const second = applyRegistrationTransition({
      step: "animal_photos",
      payload: first.payload,
      kind: "image",
      isReturningCitizen: false,
    });
    expect(second.payload.animalPhotoCount).toBe(2);

    const done = applyRegistrationTransition({
      step: "animal_photos",
      payload: second.payload,
      kind: "text",
      text: "Listo",
      isReturningCitizen: false,
    });
    expect(done.completeRegistration).toBe(true);
    expect(done.nextStep).toBe("completing");
  });

  it("completes photos on any non-image text after ≥1 photo", () => {
    const done = applyRegistrationTransition({
      step: "animal_photos",
      payload: { animalPhotoCount: 1 },
      kind: "text",
      text: "gracias",
      isReturningCitizen: false,
    });
    expect(done.completeRegistration).toBe(true);
  });

  it("accepts rabies unknown and health skip No", () => {
    const rabies = applyRegistrationTransition({
      step: "rabies_status",
      payload: {},
      kind: "text",
      text: "3",
      isReturningCitizen: false,
    });
    expect(rabies.payload.rabiesStatus).toBe("unknown");
    expect(rabies.nextStep).toBe("health_card_photo_optional");

    const skip = applyRegistrationTransition({
      step: "health_card_photo_optional",
      payload: rabies.payload,
      kind: "text",
      text: "No",
      isReturningCitizen: false,
    });
    expect(skip.nextStep).toBe("animal_photos");
  });

  it("expires session and starts fresh without stale animal data", () => {
    const r = applyRegistrationTransition({
      step: "species",
      payload: { animalName: "Firulais", species: "dog" },
      kind: "text",
      text: "hola",
      isReturningCitizen: false,
      expiresAt: new Date("2020-01-01T00:00:00Z"),
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(r.expired).toBe(true);
    expect(r.nextStep).toBe("welcome");
    expect(r.payload.animalName).toBeUndefined();
  });

  it("rejects invalid document without advancing", () => {
    const r = applyRegistrationTransition({
      step: "document_id",
      payload: {},
      kind: "text",
      text: "12",
      isReturningCitizen: false,
    });
    expect(r.nextStep).toBe("document_id");
  });

  it("confirm_citizen advances only on explicit OK", () => {
    const blocked = applyRegistrationTransition({
      step: "confirm_citizen",
      payload: { citizenId: "00000000-0000-4000-8000-000000000099" },
      kind: "text",
      text: "cambiar domicilio a Ruta 40",
      isReturningCitizen: true,
    });
    expect(blocked.nextStep).toBe("confirm_citizen");
    expect(blocked.effects[0]?.messageKey).toBe("returning.confirm_citizen");

    const ok = applyRegistrationTransition({
      step: "confirm_citizen",
      payload: { citizenId: "00000000-0000-4000-8000-000000000099" },
      kind: "text",
      text: "OK",
      isReturningCitizen: true,
    });
    expect(ok.nextStep).toBe("animal_name");
  });
});
