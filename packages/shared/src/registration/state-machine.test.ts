import { describe, expect, it } from "vitest";
import { applyRegistrationTransition, startRegistrationSession } from "./state-machine.js";

describe("startRegistrationSession", () => {
  it("starts consent for new citizen", () => {
    const s = startRegistrationSession({ isReturningCitizen: false });
    expect(s.step).toBe("consent");
    expect(s.effects[0]?.messageKey).toBe("consent.notice");
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
  it("requires consent before personal data", () => {
    const declined = applyRegistrationTransition({
      step: "consent",
      payload: {},
      kind: "text",
      text: "No",
      isReturningCitizen: false,
    });
    expect(declined.nextStep).toBe("consent");
    expect(declined.payload.fullName).toBeUndefined();

    const accepted = applyRegistrationTransition({
      step: "consent",
      payload: {},
      kind: "text",
      text: "Acepto",
      isReturningCitizen: false,
    });
    expect(accepted.nextStep).toBe("full_name");
    expect(accepted.payload.privacyConsentAt).toBeTruthy();
  });

  it("enforces citizen then animal order through location", () => {
    let step = "full_name" as const;
    let payload = {};
    const steps = [
      { text: "Juan López", expectStep: "document_id" },
      { text: "30111222", expectStep: "address_line" },
      { text: "Calle 1", expectStep: "neighborhood" },
      { text: "Centro", expectStep: "location" },
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

    const loc = applyRegistrationTransition({
      step: "location",
      payload,
      kind: "location",
      latitude: -42.1,
      longitude: -71.3,
      isReturningCitizen: false,
    });
    expect(loc.nextStep).toBe("animal_name");
    expect(loc.payload.latitude).toBe(-42.1);
  });

  it("re-prompts location on text", () => {
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

  it("blocks finish without photos then completes with photo", () => {
    const blocked = applyRegistrationTransition({
      step: "animal_photos",
      payload: { animalPhotoCount: 0 },
      kind: "text",
      text: "listo",
      isReturningCitizen: false,
    });
    expect(blocked.completeRegistration).toBe(false);
    expect(blocked.effects[0]?.messageKey).toBe("animal.photos_required");

    const withPhoto = applyRegistrationTransition({
      step: "animal_photos",
      payload: { animalPhotoCount: 0 },
      kind: "image",
      isReturningCitizen: false,
    });
    expect(withPhoto.payload.animalPhotoCount).toBe(1);

    const done = applyRegistrationTransition({
      step: "animal_photos",
      payload: withPhoto.payload,
      kind: "text",
      text: "listo",
      isReturningCitizen: false,
    });
    expect(done.completeRegistration).toBe(true);
    expect(done.nextStep).toBe("completing");
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
    expect(r.nextStep).toBe("consent");
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
