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

  it("formats confirmation with municipal id", () => {
    const text = formatRegistrationMessage("registration.confirmation", {
      animalName: "Luna",
      municipalId: "CENT-2026-00001",
    });
    expect(text).toContain("CENT-2026-00001");
    expect(text).toContain("Luna");
  });

  it("consent notice mentions Ley 25.326", () => {
    expect(registrationMessages["consent.notice"]).toMatch(/25\.326/);
  });
});
