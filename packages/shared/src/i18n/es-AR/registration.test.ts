import { describe, expect, it } from "vitest";
import {
  formatRegistrationMessage,
  registrationMessages,
  requiredRegistrationMessageKeys,
} from "./registration.js";

describe("registration i18n es-AR", () => {
  it("has all required keys with non-empty strings", () => {
    for (const key of requiredRegistrationMessageKeys) {
      expect(registrationMessages[key].length).toBeGreaterThan(0);
    }
  });

  it("formats confirmation with animal, citizen name, and municipal id", () => {
    const text = formatRegistrationMessage("registration.confirmation", {
      animalName: "Luna",
      citizenFullName: "Ana Pérez",
      municipalId: "EPU-2026-00001",
    });
    expect(text).toContain("EPU-2026-00001");
    expect(text).toContain("Luna");
    expect(text).toContain("Ana Pérez");
  });

  it("welcome introduces Inspectoría without consent gate", () => {
    expect(registrationMessages["welcome.intro"]).toMatch(/Inspectoría/);
    expect(registrationMessages["welcome.intro"]).not.toMatch(/25\.326/);
  });
});
